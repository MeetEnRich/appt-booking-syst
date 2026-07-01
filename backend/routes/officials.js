const express = require('express');
const router = express.Router();
const { dbQuery } = require('../db');
const { authenticateToken } = require('../middleware');

// GET /api/officials (Public or Authenticated)
router.get('/', async (req, res) => {
  try {
    const officials = await dbQuery.all(`
      SELECT id, name, office_title, available_days, available_start_time, available_end_time, slot_duration_minutes, buffer_duration_minutes, rest_start_time, rest_end_time 
      FROM officials
    `);
    
    // Parse available_days JSON string back to arrays
    const formatted = officials.map(o => ({
      ...o,
      available_days: JSON.parse(o.available_days)
    }));

    res.json(formatted);
  } catch (error) {
    console.error('Error fetching officials:', error);
    res.status(500).json({ error: 'Internal server error fetching officials.' });
  }
});

// GET /api/officials/:id/availability?date=YYYY-MM-DD (Authenticated)
router.get('/:id/availability', authenticateToken, async (req, res) => {
  const { id } = req.params;
  const { date } = req.query;

  if (!date) {
    return res.status(400).json({ error: 'Please specify a date query parameter (YYYY-MM-DD).' });
  }

  try {
    const official = await dbQuery.get('SELECT * FROM officials WHERE id = ?', [id]);
    if (!official) {
      return res.status(404).json({ error: 'Official not found.' });
    }

    // 1. Verify if the date falls on a blackout date
    const blackout = await dbQuery.get('SELECT * FROM blackout_dates WHERE official_id = ? AND date = ?', [id, date]);
    if (blackout) {
      return res.json({
        available: false,
        reason: `${official.name} is unavailable on this date. Reason: ${blackout.reason || 'Official blackout date'}.`,
        slots: []
      });
    }

    // 2. Verify if the date falls on a working day
    const requestDate = new Date(date);
    if (isNaN(requestDate.getTime())) {
      return res.status(400).json({ error: 'Invalid date format. Use YYYY-MM-DD.' });
    }

    const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const requestedDay = weekdays[requestDate.getDay()];
    const availableDays = JSON.parse(official.available_days);

    if (!availableDays.includes(requestedDay)) {
      return res.json({
        available: false,
        reason: `${official.name} is not available on ${requestedDay}s.`,
        slots: []
      });
    }

    // 3. Generate all potential slots for the day incorporating buffer and rest periods
    const slots = [];
    const [startHour, startMin] = official.available_start_time.split(':').map(Number);
    const [endHour, endMin] = official.available_end_time.split(':').map(Number);
    const duration = official.slot_duration_minutes;
    const buffer = official.buffer_duration_minutes || 0;

    let current = new Date();
    current.setHours(startHour, startMin, 0, 0);

    const endLimit = new Date();
    endLimit.setHours(endHour, endMin, 0, 0);

    const formatTime = (dateObj) => {
      const hh = String(dateObj.getHours()).padStart(2, '0');
      const mm = String(dateObj.getMinutes()).padStart(2, '0');
      return `${hh}:${mm}`;
    };

    while (current < endLimit) {
      const timeStr = formatTime(current);
      
      const slotEnd = new Date(current);
      slotEnd.setMinutes(slotEnd.getMinutes() + duration);

      // Parse lunch break/rest hours
      const [restStartH, restStartM] = (official.rest_start_time || '13:00').split(':').map(Number);
      const [restEndH, restEndM] = (official.rest_end_time || '14:00').split(':').map(Number);

      const restStart = new Date(current);
      restStart.setHours(restStartH, restStartM, 0, 0);

      const restEnd = new Date(current);
      restEnd.setHours(restEndH, restEndM, 0, 0);

      // Check if slot overlaps with rest window: slotStart < restEnd AND slotEnd > restStart
      const overlapsRest = (current < restEnd && slotEnd > restStart);

      if (!overlapsRest && slotEnd <= endLimit) {
        slots.push(timeStr);
      }

      // Next slot starts after (meeting duration + buffer)
      current.setMinutes(current.getMinutes() + duration + buffer);
    }

    // 4. Fetch existing appointments for this official and date
    const bookedAppointments = await dbQuery.all(
      `SELECT requested_time, status FROM appointments 
       WHERE official_id = ? 
         AND requested_date = ? 
         AND status IN ('pending', 'approved', 'rescheduled')`,
      [id, date]
    );

    const bookedTimes = bookedAppointments.map(app => app.requested_time);

    // 5. Map slots to indicate if booked or not (and block past times if date is today)
    const todayStr = new Date().toISOString().split('T')[0];
    const now = new Date();
    
    const slotsWithStatus = slots.map(time => {
      const [sh, sm] = time.split(':').map(Number);
      const isBooked = bookedTimes.includes(time);
      
      let isPast = false;
      if (date === todayStr) {
        const slotTime = new Date();
        slotTime.setHours(sh, sm, 0, 0);
        isPast = slotTime < now;
      }

      return {
        time,
        available: !isBooked && !isPast,
        reason: isBooked ? 'Already booked' : (isPast ? 'Time has passed' : 'Available')
      };
    });

    res.json({
      available: true,
      slots: slotsWithStatus
    });
  } catch (error) {
    console.error('Error computing availability:', error);
    res.status(500).json({ error: 'Internal server error computing availability.' });
  }
});

module.exports = router;
