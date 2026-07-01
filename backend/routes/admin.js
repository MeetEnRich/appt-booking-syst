const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { dbQuery } = require('../db');
const { authenticateToken, requireRole } = require('../middleware');

// Protect all admin endpoints
router.use(authenticateToken);
router.use(requireRole(['admin']));

// GET /api/admin/stats - System-wide stats & dashboard details
router.get('/stats', async (req, res) => {
  try {
    // 1. Total appointments count
    const totalCount = await dbQuery.get('SELECT COUNT(1) AS count FROM appointments');
    
    // 2. Status counts
    const statusCounts = await dbQuery.all(`
      SELECT status, COUNT(1) AS count 
      FROM appointments 
      GROUP BY status
    `);

    const statusMap = {
      pending: 0,
      approved: 0,
      rejected: 0,
      rescheduled: 0,
      cancelled: 0,
      completed: 0
    };
    statusCounts.forEach(s => {
      statusMap[s.status] = s.count;
    });

    // 3. Busiest officials (top 5 by appointment count)
    const busiestOfficials = await dbQuery.all(`
      SELECT o.name, o.office_title, COUNT(a.id) AS appointment_count
      FROM appointments a
      JOIN officials o ON a.official_id = o.id
      GROUP BY o.id
      ORDER BY appointment_count DESC
      LIMIT 5
    `);

    // 4. Compute No-show rate: (approved appointments in the past) / (completed + approved appointments in the past)
    const todayStr = new Date().toISOString().split('T')[0];
    
    const completedCountRow = await dbQuery.get(
      `SELECT COUNT(1) AS count FROM appointments WHERE status = 'completed'`
    );
    const completedCount = completedCountRow.count || 0;

    const noShowCountRow = await dbQuery.get(
      `SELECT COUNT(1) AS count FROM appointments 
       WHERE status = 'approved' AND requested_date < ?`,
      [todayStr]
    );
    const noShowCount = noShowCountRow.count || 0;

    const totalExpectedAttendance = completedCount + noShowCount;
    const noShowRate = totalExpectedAttendance > 0 
      ? Math.round((noShowCount / totalExpectedAttendance) * 100) 
      : 0;

    // 5. System logs (simulated emails) - get latest 10 logs
    const logs = await dbQuery.all(`
      SELECT * FROM system_logs 
      ORDER BY created_at DESC 
      LIMIT 10
    `);

    // 6. Compute average waiting time (difference in minutes between requested time and actual check-in updated_at)
    const completedApps = await dbQuery.all(
      `SELECT requested_date, requested_time, updated_at FROM appointments WHERE status = 'completed'`
    );

    let totalWaitMinutes = 0;
    let countedApps = 0;

    completedApps.forEach(app => {
      try {
        const scheduledTime = new Date(`${app.requested_date}T${app.requested_time}:00`);
        const actualCheckIn = new Date(app.updated_at.replace(' ', 'T'));
        
        if (!isNaN(scheduledTime.getTime()) && !isNaN(actualCheckIn.getTime())) {
          const diffMs = actualCheckIn - scheduledTime;
          const diffMins = Math.floor(diffMs / 60000);
          totalWaitMinutes += Math.max(0, diffMins);
          countedApps++;
        }
      } catch (err) {
        console.error('Wait time calculation error for app:', app, err);
      }
    });

    const avgWaitTime = countedApps > 0 ? Math.round(totalWaitMinutes / countedApps) : 0;

    res.json({
      totalCount: totalCount.count || 0,
      statusCounts: statusMap,
      busiestOfficials,
      noShowRate,
      noShowCount,
      completedCount,
      avgWaitTime,
      logs
    });
  } catch (error) {
    console.error('Error compiling admin statistics:', error);
    res.status(500).json({ error: 'Internal server error compiling stats.' });
  }
});

// GET /api/admin/export/appointments - Get all appointments for audit export
router.get('/export/appointments', async (req, res) => {
  try {
    const list = await dbQuery.all(`
      SELECT a.id, u.full_name AS visitor_name, u.email AS visitor_email, u.matric_staff_id AS visitor_identifier,
             o.name AS official_name, o.office_title, a.requested_date, a.requested_time, a.purpose, a.status, a.created_at, a.updated_at
      FROM appointments a
      JOIN users u ON a.visitor_user_id = u.id
      JOIN officials o ON a.official_id = o.id
      ORDER BY a.created_at DESC
    `);
    res.json(list);
  } catch (error) {
    console.error('Error exporting appointments:', error);
    res.status(500).json({ error: 'Internal server error exporting appointments.' });
  }
});

// GET /api/admin/export/logs - Get all system logs for audit export
router.get('/export/logs', async (req, res) => {
  try {
    const list = await dbQuery.all('SELECT * FROM system_logs ORDER BY created_at DESC');
    res.json(list);
  } catch (error) {
    console.error('Error exporting system logs:', error);
    res.status(500).json({ error: 'Internal server error exporting logs.' });
  }
});

// GET /api/admin/officials - List officials with secretary info
router.get('/officials', async (req, res) => {
  try {
    const officials = await dbQuery.all(`
      SELECT o.*, u.full_name AS secretary_name, u.email AS secretary_email 
      FROM officials o
      LEFT JOIN users u ON o.secretary_user_id = u.id
    `);

    const formatted = officials.map(o => ({
      ...o,
      available_days: JSON.parse(o.available_days)
    }));

    res.json(formatted);
  } catch (error) {
    console.error('Error fetching admin officials list:', error);
    res.status(500).json({ error: 'Internal server error fetching officials.' });
  }
});

// POST /api/admin/officials - Create a new official
router.post('/officials', async (req, res) => {
  const { name, office_title, secretary_user_id, available_days, available_start_time, available_end_time, slot_duration_minutes } = req.body;

  if (!name || !office_title || !available_days || !available_start_time || !available_end_time) {
    return res.status(400).json({ error: 'Please provide official name, office title, available days, start time, and end time.' });
  }

  try {
    // If a secretary user ID is provided, verify it exists and is a secretary
    if (secretary_user_id) {
      const secretary = await dbQuery.get('SELECT role FROM users WHERE id = ?', [secretary_user_id]);
      if (!secretary || secretary.role !== 'secretary') {
        return res.status(400).json({ error: 'Selected user is not a valid secretary.' });
      }

      // Check if the secretary is already assigned to another official
      const alreadyAssigned = await dbQuery.get('SELECT id, name FROM officials WHERE secretary_user_id = ?', [secretary_user_id]);
      if (alreadyAssigned) {
        return res.status(400).json({ error: `This secretary is already assigned to ${alreadyAssigned.name}.` });
      }
    }

    const result = await dbQuery.run(
      `INSERT INTO officials (name, office_title, secretary_user_id, available_days, available_start_time, available_end_time, slot_duration_minutes) 
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        name.trim(),
        office_title.trim(),
        secretary_user_id || null,
        JSON.stringify(available_days),
        available_start_time,
        available_end_time,
        slot_duration_minutes || 30
      ]
    );

    res.status(201).json({ message: 'Official profile created successfully.', officialId: result.id });
  } catch (error) {
    console.error('Error creating official:', error);
    res.status(500).json({ error: 'Internal server error creating official.' });
  }
});

// PUT /api/admin/officials/:id - Update an official
router.put('/officials/:id', async (req, res) => {
  const { id } = req.params;
  const { name, office_title, secretary_user_id, available_days, available_start_time, available_end_time, slot_duration_minutes } = req.body;

  if (!name || !office_title || !available_days || !available_start_time || !available_end_time) {
    return res.status(400).json({ error: 'Please fill all required fields.' });
  }

  try {
    const official = await dbQuery.get('SELECT id FROM officials WHERE id = ?', [id]);
    if (!official) {
      return res.status(404).json({ error: 'Official not found.' });
    }

    if (secretary_user_id) {
      const secretary = await dbQuery.get('SELECT role FROM users WHERE id = ?', [secretary_user_id]);
      if (!secretary || secretary.role !== 'secretary') {
        return res.status(400).json({ error: 'Selected user is not a valid secretary.' });
      }

      // Check if this secretary is already assigned to a DIFFERENT official
      const alreadyAssigned = await dbQuery.get(
        'SELECT id, name FROM officials WHERE secretary_user_id = ? AND id != ?',
        [secretary_user_id, id]
      );
      if (alreadyAssigned) {
        return res.status(400).json({ error: `Selected secretary is already assigned to ${alreadyAssigned.name}.` });
      }
    }

    await dbQuery.run(
      `UPDATE officials 
       SET name = ?, office_title = ?, secretary_user_id = ?, available_days = ?, available_start_time = ?, available_end_time = ?, slot_duration_minutes = ? 
       WHERE id = ?`,
      [
        name.trim(),
        office_title.trim(),
        secretary_user_id || null,
        JSON.stringify(available_days),
        available_start_time,
        available_end_time,
        slot_duration_minutes || 30,
        id
      ]
    );

    res.json({ message: 'Official profile updated successfully.' });
  } catch (error) {
    console.error('Error updating official:', error);
    res.status(500).json({ error: 'Internal server error updating official.' });
  }
});

// POST /api/admin/secretaries - Create a secretary account
router.post('/secretaries', async (req, res) => {
  const { full_name, email, password } = req.body;

  if (!full_name || !email || !password) {
    return res.status(400).json({ error: 'Please provide full name, email, and password.' });
  }

  try {
    const existing = await dbQuery.get('SELECT id FROM users WHERE email = ?', [email.toLowerCase().trim()]);
    if (existing) {
      return res.status(400).json({ error: 'User with this email already exists.' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const result = await dbQuery.run(
      `INSERT INTO users (full_name, email, password_hash, role) VALUES (?, ?, ?, 'secretary')`,
      [full_name.trim(), email.toLowerCase().trim(), hashedPassword]
    );

    res.status(201).json({
      message: 'Secretary account created successfully.',
      secretaryId: result.id
    });
  } catch (error) {
    console.error('Error creating secretary account:', error);
    res.status(500).json({ error: 'Internal server error creating secretary.' });
  }
});

// GET /api/admin/secretaries/unassigned - Secretaries who aren't managing any officials yet
router.get('/secretaries/unassigned', async (req, res) => {
  try {
    const list = await dbQuery.all(`
      SELECT id, full_name, email FROM users 
      WHERE role = 'secretary' 
        AND id NOT IN (
          SELECT secretary_user_id FROM officials WHERE secretary_user_id IS NOT NULL
        )
    `);
    res.json(list);
  } catch (error) {
    console.error('Error fetching unassigned secretaries:', error);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// GET /api/admin/secretaries/all - List all secretaries
router.get('/secretaries/all', async (req, res) => {
  try {
    const list = await dbQuery.all(`
      SELECT id, full_name, email, created_at FROM users 
      WHERE role = 'secretary'
      ORDER BY full_name ASC
    `);
    res.json(list);
  } catch (error) {
    console.error('Error fetching all secretaries:', error);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

module.exports = router;
