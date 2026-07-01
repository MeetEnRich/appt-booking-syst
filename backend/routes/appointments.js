const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const { dbQuery } = require('../db');
const { authenticateToken, requireRole } = require('../middleware');
const { sendSimulatedEmail } = require('../emailHelper');
const { sendRealTimeAlert } = require('../websocket');

const JWT_SECRET = process.env.JWT_SECRET || 'fulafia_secret_key';

function generateSecureQRToken(appointmentId, visitorUserId, requestedDate) {
  const payload = JSON.stringify({ id: appointmentId, visitorId: visitorUserId, date: requestedDate });
  const signature = crypto.createHmac('sha256', JWT_SECRET).update(payload).digest('hex');
  return `${appointmentId}:${signature}`;
}

// Helper to create notifications
async function createNotification(userId, message, appointmentId = null) {
  try {
    await dbQuery.run(
      `INSERT INTO notifications (user_id, message, related_appointment_id, is_read) VALUES (?, ?, ?, 0)`,
      [userId, message, appointmentId]
    );
  } catch (err) {
    console.error('Failed to create notification:', err.message);
  }
}

// ==========================================
// VISITOR ENDPOINTS
// ==========================================

// POST /api/appointments - Visitor creates booking request
router.post('/', authenticateToken, requireRole(['visitor']), async (req, res) => {
  const { official_id, requested_date, requested_time, purpose } = req.body;
  const visitor_user_id = req.user.id;

  if (!official_id || !requested_date || !requested_time || !purpose) {
    return res.status(400).json({ error: 'Please provide official_id, requested_date, requested_time, and purpose.' });
  }

  try {
    // 0. Check for visitor no-shows suspension (limit > 2)
    const todayStr = new Date().toISOString().split('T')[0];
    const noShows = await dbQuery.get(
      `SELECT COUNT(1) AS count FROM appointments 
       WHERE visitor_user_id = ? 
         AND status = 'approved' 
         AND requested_date < ?`,
      [visitor_user_id, todayStr]
    );

    if (noShows && noShows.count > 2) {
      return res.status(403).json({ error: 'Your booking privileges have been suspended due to 3 or more missed appointments (no-shows). Please contact the administration.' });
    }

    // 1. Fetch official details
    const official = await dbQuery.get('SELECT * FROM officials WHERE id = ?', [official_id]);
    if (!official) {
      return res.status(404).json({ error: 'Official not found.' });
    }

    // 2. Validate requested date/time is in the future
    const requestedDateTime = new Date(`${requested_date}T${requested_time}:00`);
    if (isNaN(requestedDateTime.getTime()) || requestedDateTime < new Date()) {
      return res.status(400).json({ error: 'Cannot book appointments in the past.' });
    }

    // 3. Verify weekday availability
    const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const dayName = weekdays[requestedDateTime.getDay()];
    const availableDays = JSON.parse(official.available_days);
    if (!availableDays.includes(dayName)) {
      return res.status(400).json({ error: `This official is not available on ${dayName}s.` });
    }

    // 4. Conflict Check: Look for existing pending, approved, or rescheduled appointments at same slot
    const conflict = await dbQuery.get(
      `SELECT id FROM appointments 
       WHERE official_id = ? 
         AND requested_date = ? 
         AND requested_time = ? 
         AND status IN ('pending', 'approved', 'rescheduled')`,
      [official_id, requested_date, requested_time]
    );

    if (conflict) {
      return res.status(409).json({ error: 'This time slot is already booked or has a pending request. Please choose another.' });
    }

    // 5. Create appointment
    const result = await dbQuery.run(
      `INSERT INTO appointments (visitor_user_id, official_id, requested_date, requested_time, purpose, status) 
       VALUES (?, ?, ?, ?, ?, ?)`,
      [visitor_user_id, official_id, requested_date, requested_time, purpose.trim(), 'pending']
    );

    // 6. Notify Secretary
    if (official.secretary_user_id) {
      await createNotification(
        official.secretary_user_id,
        `New booking request from ${req.user.full_name} for ${official.name} on ${requested_date} at ${requested_time}.`,
        result.id
      );
      sendRealTimeAlert(official.secretary_user_id, {
        type: 'new_appointment',
        message: `New booking request from ${req.user.full_name} for ${official.name} on ${requested_date}.`
      });
    }

    res.status(201).json({
      message: 'Booking request submitted successfully! Pending secretary approval.',
      appointmentId: result.id
    });
  } catch (error) {
    console.error('Error creating appointment:', error);
    res.status(500).json({ error: 'Internal server error during booking.' });
  }
});

// GET /api/appointments/mine - Visitor gets their own appointments
router.get('/mine', authenticateToken, requireRole(['visitor']), async (req, res) => {
  try {
    const appointments = await dbQuery.all(
      `SELECT a.*, o.name AS official_name, o.office_title AS official_title 
       FROM appointments a 
       JOIN officials o ON a.official_id = o.id 
       WHERE a.visitor_user_id = ? 
       ORDER BY a.requested_date DESC, a.requested_time DESC`,
      [req.user.id]
    );
    res.json(appointments);
  } catch (error) {
    console.error('Error fetching visitor appointments:', error);
    res.status(500).json({ error: 'Internal server error fetching appointments.' });
  }
});

// PATCH /api/appointments/:id/cancel - Visitor cancels appointment
router.patch('/:id/cancel', authenticateToken, requireRole(['visitor']), async (req, res) => {
  const { id } = req.params;
  const visitor_user_id = req.user.id;

  try {
    const app = await dbQuery.get('SELECT * FROM appointments WHERE id = ?', [id]);
    if (!app) {
      return res.status(404).json({ error: 'Appointment not found.' });
    }

    if (app.visitor_user_id !== visitor_user_id) {
      return res.status(403).json({ error: 'You do not own this appointment.' });
    }

    if (app.status === 'completed' || app.status === 'cancelled') {
      return res.status(400).json({ error: `Cannot cancel a ${app.status} appointment.` });
    }

    await dbQuery.run(
      `UPDATE appointments SET status = 'cancelled', updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [id]
    );

    // Notify Secretary
    const official = await dbQuery.get('SELECT secretary_user_id, name FROM officials WHERE id = ?', [app.official_id]);
    if (official && official.secretary_user_id) {
      await createNotification(
        official.secretary_user_id,
        `Appointment for ${req.user.full_name} scheduled on ${app.requested_date} has been cancelled by the visitor.`,
        id
      );
      sendRealTimeAlert(official.secretary_user_id, {
        type: 'appointment_update',
        message: `Appointment for ${req.user.full_name} scheduled on ${app.requested_date} has been cancelled by the visitor.`
      });
    }

    res.json({ message: 'Appointment cancelled successfully.' });
  } catch (error) {
    console.error('Error cancelling appointment:', error);
    res.status(500).json({ error: 'Internal server error cancelling appointment.' });
  }
});

// PATCH /api/appointments/:id/accept-reschedule - Visitor accepts reschedule proposal
router.patch('/:id/accept-reschedule', authenticateToken, requireRole(['visitor']), async (req, res) => {
  const { id } = req.params;
  const visitor_user_id = req.user.id;

  try {
    const app = await dbQuery.get('SELECT * FROM appointments WHERE id = ?', [id]);
    if (!app) {
      return res.status(404).json({ error: 'Appointment not found.' });
    }

    if (app.visitor_user_id !== visitor_user_id) {
      return res.status(403).json({ error: 'You do not own this appointment.' });
    }

    if (app.status !== 'rescheduled') {
      return res.status(400).json({ error: 'This appointment has not been rescheduled.' });
    }

    const qrToken = generateSecureQRToken(id, visitor_user_id, app.requested_date);

    // Update appointment to new date & approved status
    await dbQuery.run(
      `UPDATE appointments 
       SET status = 'approved', 
           requested_date = rescheduled_date, 
           requested_time = rescheduled_time, 
           rescheduled_date = NULL, 
           rescheduled_time = NULL, 
           qr_code_token = ?,
           updated_at = CURRENT_TIMESTAMP 
       WHERE id = ?`,
      [qrToken, id]
    );

    // Notify Secretary
    const official = await dbQuery.get('SELECT secretary_user_id, name FROM officials WHERE id = ?', [app.official_id]);
    if (official && official.secretary_user_id) {
      await createNotification(
        official.secretary_user_id,
        `${req.user.full_name} has accepted the rescheduled appointment slot.`,
        id
      );
      sendRealTimeAlert(official.secretary_user_id, {
        type: 'appointment_update',
        message: `${req.user.full_name} has accepted the rescheduled appointment slot.`
      });
    }

    res.json({ message: 'Rescheduled slot accepted successfully. Appointment is now approved.', qr_code_token: qrToken });
  } catch (error) {
    console.error('Error accepting reschedule:', error);
    res.status(500).json({ error: 'Internal server error accepting reschedule.' });
  }
});

// ==========================================
// SECRETARY ENDPOINTS
// ==========================================

// Helper to verify that the secretary manages the official for a given appointment
async function getSecretaryOfficial(secretaryUserId) {
  return await dbQuery.get('SELECT * FROM officials WHERE secretary_user_id = ?', [secretaryUserId]);
}

// GET /api/secretary/appointments - List all appointments for the secretary's official
router.get('/secretary', authenticateToken, requireRole(['secretary']), async (req, res) => {
  try {
    const official = await getSecretaryOfficial(req.user.id);
    if (!official) {
      return res.status(400).json({ error: 'You are not assigned to any official profile.' });
    }

    const appointments = await dbQuery.all(
      `SELECT a.*, u.full_name AS visitor_name, u.email AS visitor_email, u.matric_staff_id AS visitor_identifier 
       FROM appointments a 
       JOIN users u ON a.visitor_user_id = u.id 
       WHERE a.official_id = ? 
       ORDER BY a.requested_date DESC, a.requested_time DESC`,
      [official.id]
    );

    res.json({
      official: {
        ...official,
        available_days: JSON.parse(official.available_days)
      },
      appointments
    });
  } catch (error) {
    console.error('Error fetching secretary appointments:', error);
    res.status(500).json({ error: 'Internal server error fetching appointments.' });
  }
});

// PUT /api/appointments/secretary/official - Update official availability settings
router.put('/secretary/official', authenticateToken, requireRole(['secretary']), async (req, res) => {
  const { available_days, available_start_time, available_end_time, slot_duration_minutes, buffer_duration_minutes, rest_start_time, rest_end_time } = req.body;

  if (!available_days || available_days.length === 0 || !available_start_time || !available_end_time) {
    return res.status(400).json({ error: 'Please provide available days, start time, and end time.' });
  }

  try {
    const official = await getSecretaryOfficial(req.user.id);
    if (!official) {
      return res.status(400).json({ error: 'You are not assigned to any official profile.' });
    }

    await dbQuery.run(
      `UPDATE officials 
       SET available_days = ?, available_start_time = ?, available_end_time = ?, slot_duration_minutes = ?, buffer_duration_minutes = ?, rest_start_time = ?, rest_end_time = ? 
       WHERE id = ?`,
      [
        JSON.stringify(available_days),
        available_start_time,
        available_end_time,
        parseInt(slot_duration_minutes) || 30,
        parseInt(buffer_duration_minutes) || 0,
        rest_start_time || '13:00',
        rest_end_time || '14:00',
        official.id
      ]
    );

    res.json({ message: 'Office availability configuration updated successfully.' });
  } catch (error) {
    console.error('Error updating official availability:', error);
    res.status(500).json({ error: 'Internal server error updating configuration.' });
  }
});

// GET /api/appointments/secretary/blackouts - Get all blackout dates for the official managed by the secretary
router.get('/secretary/blackouts', authenticateToken, requireRole(['secretary']), async (req, res) => {
  try {
    const official = await getSecretaryOfficial(req.user.id);
    if (!official) {
      return res.status(400).json({ error: 'You are not assigned to any official profile.' });
    }
    const blackouts = await dbQuery.all('SELECT * FROM blackout_dates WHERE official_id = ? ORDER BY date ASC', [official.id]);
    res.json(blackouts);
  } catch (error) {
    console.error('Error fetching blackout dates:', error);
    res.status(500).json({ error: 'Internal server error fetching blackout dates.' });
  }
});

// POST /api/appointments/secretary/blackouts - Add a new blackout date for the official
router.post('/secretary/blackouts', authenticateToken, requireRole(['secretary']), async (req, res) => {
  const { date, reason } = req.body;
  if (!date) {
    return res.status(400).json({ error: 'Date is required.' });
  }

  try {
    const official = await getSecretaryOfficial(req.user.id);
    if (!official) {
      return res.status(400).json({ error: 'You are not assigned to any official profile.' });
    }

    // Check if blackout date already exists
    const existing = await dbQuery.get('SELECT * FROM blackout_dates WHERE official_id = ? AND date = ?', [official.id, date]);
    if (existing) {
      return res.status(400).json({ error: 'This date is already marked as a blackout date.' });
    }

    await dbQuery.run(
      'INSERT INTO blackout_dates (official_id, date, reason) VALUES (?, ?, ?)',
      [official.id, date, reason || '']
    );

    res.status(201).json({ message: 'Blackout date added successfully.' });
  } catch (error) {
    console.error('Error adding blackout date:', error);
    res.status(500).json({ error: 'Internal server error adding blackout date.' });
  }
});

// DELETE /api/appointments/secretary/blackouts/:id - Remove a blackout date
router.delete('/secretary/blackouts/:id', authenticateToken, requireRole(['secretary']), async (req, res) => {
  const { id } = req.params;

  try {
    const official = await getSecretaryOfficial(req.user.id);
    if (!official) {
      return res.status(400).json({ error: 'You are not assigned to any official profile.' });
    }

    // Verify ownership of the blackout date
    const blackout = await dbQuery.get('SELECT * FROM blackout_dates WHERE id = ?', [id]);
    if (!blackout || blackout.official_id !== official.id) {
      return res.status(404).json({ error: 'Blackout date not found or unauthorized.' });
    }

    await dbQuery.run('DELETE FROM blackout_dates WHERE id = ?', [id]);
    res.json({ message: 'Blackout date removed successfully.' });
  } catch (error) {
    console.error('Error deleting blackout date:', error);
    res.status(500).json({ error: 'Internal server error deleting blackout date.' });
  }
});

// PATCH /api/secretary/appointments/:id/approve - Approve request
router.patch('/secretary/:id/approve', authenticateToken, requireRole(['secretary']), async (req, res) => {
  const { id } = req.params;

  try {
    const official = await getSecretaryOfficial(req.user.id);
    const app = await dbQuery.get('SELECT * FROM appointments WHERE id = ?', [id]);
    
    if (!app || app.official_id !== official.id) {
      return res.status(404).json({ error: 'Appointment not found or unauthorized.' });
    }

    const qrToken = generateSecureQRToken(id, app.visitor_user_id, app.requested_date);

    await dbQuery.run(
      `UPDATE appointments 
       SET status = 'approved', qr_code_token = ?, updated_at = CURRENT_TIMESTAMP 
       WHERE id = ?`,
      [qrToken, id]
    );

    // Notify Visitor
    await createNotification(
      app.visitor_user_id,
      `Your appointment request with ${official.name} on ${app.requested_date} has been approved.`,
      id
    );
    sendRealTimeAlert(app.visitor_user_id, {
      type: 'appointment_update',
      message: `Your appointment request with ${official.name} on ${app.requested_date} has been approved.`
    });

    // Send Simulated Email
    const visitor = await dbQuery.get('SELECT email, full_name FROM users WHERE id = ?', [app.visitor_user_id]);
    if (visitor) {
      await sendSimulatedEmail(
        visitor.email,
        'Appointment Approved - FULafia Appointment Booking',
        `Dear ${visitor.full_name},\n\nYour appointment request with ${official.name} (${official.office_title}) for ${app.requested_date} at ${app.requested_time} has been APPROVED.\n\nPlease log in to the portal to view your digital slip and QR Code confirmation.\n\nBest regards,\nOffice of the ${official.office_title}`
      );
    }

    res.json({ message: 'Appointment approved successfully.', qr_code_token: qrToken });
  } catch (error) {
    console.error('Error approving appointment:', error);
    res.status(500).json({ error: 'Internal server error approving appointment.' });
  }
});

// PATCH /api/secretary/appointments/:id/reject - Reject request (requires note)
router.post('/secretary/:id/reject', authenticateToken, requireRole(['secretary']), async (req, res) => {
  const { id } = req.params;
  const { note } = req.body;

  if (!note || note.trim() === '') {
    return res.status(400).json({ error: 'A rejection note stating the reason is required.' });
  }

  try {
    const official = await getSecretaryOfficial(req.user.id);
    const app = await dbQuery.get('SELECT * FROM appointments WHERE id = ?', [id]);
    
    if (!app || app.official_id !== official.id) {
      return res.status(404).json({ error: 'Appointment not found or unauthorized.' });
    }

    await dbQuery.run(
      `UPDATE appointments 
       SET status = 'rejected', secretary_note = ?, updated_at = CURRENT_TIMESTAMP 
       WHERE id = ?`,
      [note.trim(), id]
    );

    // Notify Visitor
    await createNotification(
      app.visitor_user_id,
      `Your appointment request with ${official.name} on ${app.requested_date} has been rejected. Reason: ${note}`,
      id
    );
    sendRealTimeAlert(app.visitor_user_id, {
      type: 'appointment_update',
      message: `Your appointment request with ${official.name} on ${app.requested_date} has been rejected.`
    });

    // Send Simulated Email
    const visitor = await dbQuery.get('SELECT email, full_name FROM users WHERE id = ?', [app.visitor_user_id]);
    if (visitor) {
      await sendSimulatedEmail(
        visitor.email,
        'Appointment Rejected - FULafia Appointment Booking',
        `Dear ${visitor.full_name},\n\nWe regret to inform you that your appointment request with ${official.name} (${official.office_title}) for ${app.requested_date} at ${app.requested_time} was rejected.\n\nReason: ${note}\n\nBest regards,\nOffice of the ${official.office_title}`
      );
    }

    res.json({ message: 'Appointment rejected successfully.' });
  } catch (error) {
    console.error('Error rejecting appointment:', error);
    res.status(500).json({ error: 'Internal server error rejecting appointment.' });
  }
});

// PATCH /api/secretary/appointments/:id/reschedule - Propose reschedule (requires date, time, and note)
router.post('/secretary/:id/reschedule', authenticateToken, requireRole(['secretary']), async (req, res) => {
  const { id } = req.params;
  const { rescheduled_date, rescheduled_time, note } = req.body;

  if (!rescheduled_date || !rescheduled_time || !note || note.trim() === '') {
    return res.status(400).json({ error: 'Please provide rescheduled date, time, and a reason note.' });
  }

  try {
    const official = await getSecretaryOfficial(req.user.id);
    const app = await dbQuery.get('SELECT * FROM appointments WHERE id = ?', [id]);
    
    if (!app || app.official_id !== official.id) {
      return res.status(404).json({ error: 'Appointment not found or unauthorized.' });
    }

    // Conflict Check: Check if proposed rescheduled slot is already occupied
    const conflict = await dbQuery.get(
      `SELECT id FROM appointments 
       WHERE official_id = ? 
         AND (
           (requested_date = ? AND requested_time = ? AND status IN ('pending', 'approved'))
           OR 
           (rescheduled_date = ? AND rescheduled_time = ? AND status = 'rescheduled')
         )
         AND id != ?`,
      [official.id, rescheduled_date, rescheduled_time, rescheduled_date, rescheduled_time, id]
    );

    if (conflict) {
      return res.status(409).json({ error: 'The proposed rescheduled slot is already occupied. Please pick another slot.' });
    }

    await dbQuery.run(
      `UPDATE appointments 
       SET status = 'rescheduled', 
           rescheduled_date = ?, 
           rescheduled_time = ?, 
           secretary_note = ?, 
           updated_at = CURRENT_TIMESTAMP 
       WHERE id = ?`,
      [rescheduled_date, rescheduled_time, note.trim(), id]
    );

    // Notify Visitor
    await createNotification(
      app.visitor_user_id,
      `Your appointment request with ${official.name} has been rescheduled to ${rescheduled_date} at ${rescheduled_time}. Action required.`,
      id
    );
    sendRealTimeAlert(app.visitor_user_id, {
      type: 'appointment_update',
      message: `Your appointment request with ${official.name} has been rescheduled to ${rescheduled_date} at ${rescheduled_time}. Action required.`
    });

    // Send Simulated Email
    const visitor = await dbQuery.get('SELECT email, full_name FROM users WHERE id = ?', [app.visitor_user_id]);
    if (visitor) {
      await sendSimulatedEmail(
        visitor.email,
        'Appointment Rescheduled Proposal - FULafia Appointment Booking',
        `Dear ${visitor.full_name},\n\nYour appointment request with ${official.name} (${official.office_title}) has been rescheduled to a proposed slot: ${rescheduled_date} at ${rescheduled_time}.\n\nReason: ${note}\n\nPlease log in to the portal to ACCEPT or CANCEL this proposal.\n\nBest regards,\nOffice of the ${official.office_title}`
      );
    }

    res.json({ message: 'Appointment reschedule proposed successfully.' });
  } catch (error) {
    console.error('Error proposing reschedule:', error);
    res.status(500).json({ error: 'Internal server error proposing reschedule.' });
  }
});

// PATCH /api/secretary/appointments/:id/complete - QR Scanner/Verification Check-in
router.patch('/secretary/:id/complete', authenticateToken, requireRole(['secretary']), async (req, res) => {
  const { id } = req.params;
  const { qr_token } = req.body;

  try {
    const official = await getSecretaryOfficial(req.user.id);
    const app = await dbQuery.get('SELECT * FROM appointments WHERE id = ?', [id]);
    
    if (!app || app.official_id !== official.id) {
      return res.status(404).json({ error: 'Appointment not found or unauthorized.' });
    }

    // Verify token matches if provided
    if (qr_token) {
      if (app.qr_code_token !== qr_token) {
        return res.status(400).json({ error: 'QR Code verification failed. Token mismatch.' });
      }

      // Cryptographic signature check (timingSafeEqual)
      try {
        const parts = qr_token.split(':');
        if (parts.length !== 2) {
          return res.status(400).json({ error: 'Invalid QR token format.' });
        }
        
        const [tokenAppId, tokenSignature] = parts;
        const expectedSignature = crypto.createHmac('sha256', JWT_SECRET)
          .update(JSON.stringify({ id: app.id, visitorId: app.visitor_user_id, date: app.requested_date }))
          .digest('hex');

        const tokenSigBuffer = Buffer.from(tokenSignature, 'hex');
        const expectedSigBuffer = Buffer.from(expectedSignature, 'hex');

        if (tokenSigBuffer.length !== expectedSigBuffer.length || 
            !crypto.timingSafeEqual(tokenSigBuffer, expectedSigBuffer)) {
          return res.status(400).json({ error: 'Invalid QR Code signature. Cryptographic tamper check failed.' });
        }
      } catch (err) {
        return res.status(400).json({ error: 'QR verification failed. Cryptographic error.' });
      }
    }

    if (app.status !== 'approved') {
      return res.status(400).json({ error: `Only approved appointments can be checked in. Current status: ${app.status}` });
    }

    await dbQuery.run(
      `UPDATE appointments SET status = 'completed', updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [id]
    );

    // Notify Visitor
    await createNotification(
      app.visitor_user_id,
      `Your appointment with ${official.name} has been marked as Completed. Thank you.`,
      id
    );

    res.json({ message: 'Visitor checked in successfully. Appointment marked as completed.' });
  } catch (error) {
    console.error('Error completing appointment check-in:', error);
    res.status(500).json({ error: 'Internal server error completing check-in.' });
  }
});

module.exports = router;
