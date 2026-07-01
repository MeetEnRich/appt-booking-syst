const express = require('express');
const router = express.Router();
const { dbQuery } = require('../db');
const { authenticateToken } = require('../middleware');

// GET /api/notifications - Get all notifications for current user
router.get('/', authenticateToken, async (req, res) => {
  try {
    const notifications = await dbQuery.all(
      `SELECT * FROM notifications 
       WHERE user_id = ? 
       ORDER BY created_at DESC`,
      [req.user.id]
    );
    res.json(notifications);
  } catch (error) {
    console.error('Error fetching notifications:', error);
    res.status(500).json({ error: 'Internal server error fetching notifications.' });
  }
});

// PATCH /api/notifications/:id/read - Mark a notification as read
router.patch('/:id/read', authenticateToken, async (req, res) => {
  const { id } = req.params;

  try {
    const notif = await dbQuery.get('SELECT * FROM notifications WHERE id = ?', [id]);
    if (!notif) {
      return res.status(404).json({ error: 'Notification not found.' });
    }

    if (notif.user_id !== req.user.id) {
      return res.status(403).json({ error: 'Unauthorized to modify this notification.' });
    }

    await dbQuery.run(
      `UPDATE notifications SET is_read = 1 WHERE id = ?`,
      [id]
    );

    res.json({ message: 'Notification marked as read.' });
  } catch (error) {
    console.error('Error reading notification:', error);
    res.status(500).json({ error: 'Internal server error updating notification.' });
  }
});

// PATCH /api/notifications/read-all - Mark all as read
router.patch('/read-all', authenticateToken, async (req, res) => {
  try {
    await dbQuery.run(
      `UPDATE notifications SET is_read = 1 WHERE user_id = ?`,
      [req.user.id]
    );
    res.json({ message: 'All notifications marked as read.' });
  } catch (error) {
    console.error('Error reading all notifications:', error);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

module.exports = router;
