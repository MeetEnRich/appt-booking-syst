const bcrypt = require('bcryptjs');
const { dbQuery, initDb, db } = require('./db');

async function seed() {
  try {
    console.log('Starting database seeding...');
    await initDb();

    // Clear existing data to avoid conflicts on re-runs
    await dbQuery.run('DELETE FROM notifications');
    await dbQuery.run('DELETE FROM appointments');
    await dbQuery.run('DELETE FROM officials');
    await dbQuery.run('DELETE FROM users');
    await dbQuery.run('DELETE FROM system_logs');
    console.log('Cleared existing tables.');

    // Common password hash for test accounts
    const passwordHash = await bcrypt.hash('password123', 10);

    // 1. Create Admin
    const adminUser = await dbQuery.run(
      `INSERT INTO users (full_name, email, password_hash, role) VALUES (?, ?, ?, ?)`,
      ['University Admin', 'admin@fulafia.edu.ng', passwordHash, 'admin']
    );
    console.log('Seeded Admin account (admin@fulafia.edu.ng)');

    // 2. Create Secretaries
    const vcSecUser = await dbQuery.run(
      `INSERT INTO users (full_name, email, password_hash, role) VALUES (?, ?, ?, ?)`,
      ['Mrs. Florence Alao', 'vc_sec@fulafia.edu.ng', passwordHash, 'secretary']
    );
    const regSecUser = await dbQuery.run(
      `INSERT INTO users (full_name, email, password_hash, role) VALUES (?, ?, ?, ?)`,
      ['Mr. Bala Ibrahim', 'reg_sec@fulafia.edu.ng', passwordHash, 'secretary']
    );
    const deanSecUser = await dbQuery.run(
      `INSERT INTO users (full_name, email, password_hash, role) VALUES (?, ?, ?, ?)`,
      ['Mrs. Grace John', 'dean_sec@fulafia.edu.ng', passwordHash, 'secretary']
    );
    const bursarSecUser = await dbQuery.run(
      `INSERT INTO users (full_name, email, password_hash, role) VALUES (?, ?, ?, ?)`,
      ['Mr. Simon Onyilo', 'bursar_sec@fulafia.edu.ng', passwordHash, 'secretary']
    );
    const dvcSecUser = await dbQuery.run(
      `INSERT INTO users (full_name, email, password_hash, role) VALUES (?, ?, ?, ?)`,
      ['Mrs. Amina Yusuf', 'dvc_sec@fulafia.edu.ng', passwordHash, 'secretary']
    );
    console.log('Seeded Secretary accounts');

    // 3. Create Officials linked to Secretaries
    const vcOfficial = await dbQuery.run(
      `INSERT INTO officials (name, office_title, secretary_user_id, available_days, available_start_time, available_end_time, slot_duration_minutes, buffer_duration_minutes, rest_start_time, rest_end_time) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        'Prof. Shehu Abdul Rahman',
        'Vice Chancellor',
        vcSecUser.id,
        JSON.stringify(['Mon', 'Tue', 'Wed', 'Thu', 'Fri']),
        '09:00',
        '16:00',
        30,
        10,
        '13:00',
        '14:00'
      ]
    );

    const regOfficial = await dbQuery.run(
      `INSERT INTO officials (name, office_title, secretary_user_id, available_days, available_start_time, available_end_time, slot_duration_minutes, buffer_duration_minutes, rest_start_time, rest_end_time) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        'Malam Nuradeen Abdu',
        'Registrar',
        regSecUser.id,
        JSON.stringify(['Mon', 'Tue', 'Wed', 'Thu', 'Fri']),
        '09:00',
        '16:00',
        30,
        10,
        '13:00',
        '14:00'
      ]
    );

    const deanOfficial = await dbQuery.run(
      `INSERT INTO officials (name, office_title, secretary_user_id, available_days, available_start_time, available_end_time, slot_duration_minutes, buffer_duration_minutes, rest_start_time, rest_end_time) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        'Prof. Shuaib Abdulsalam',
        'Dean, Faculty of Computing',
        deanSecUser.id,
        JSON.stringify(['Mon', 'Tue', 'Wed']),
        '10:00',
        '15:00',
        30,
        10,
        '12:30',
        '13:30'
      ]
    );

    const bursarOfficial = await dbQuery.run(
      `INSERT INTO officials (name, office_title, secretary_user_id, available_days, available_start_time, available_end_time, slot_duration_minutes, buffer_duration_minutes, rest_start_time, rest_end_time) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        'Mr. Daniel Wilson',
        'Bursar',
        bursarSecUser.id,
        JSON.stringify(['Mon', 'Tue', 'Wed', 'Thu', 'Fri']),
        '09:00',
        '16:00',
        30,
        15,
        '13:00',
        '14:00'
      ]
    );

    const dvcOfficial = await dbQuery.run(
      `INSERT INTO officials (name, office_title, secretary_user_id, available_days, available_start_time, available_end_time, slot_duration_minutes, buffer_duration_minutes, rest_start_time, rest_end_time) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        'Prof. Mamman Aliyu',
        'Deputy Vice Chancellor (Academic)',
        dvcSecUser.id,
        JSON.stringify(['Mon', 'Tue', 'Thu', 'Fri']),
        '10:00',
        '15:00',
        30,
        10,
        '13:00',
        '14:00'
      ]
    );

    const librarianOfficial = await dbQuery.run(
      `INSERT INTO officials (name, office_title, secretary_user_id, available_days, available_start_time, available_end_time, slot_duration_minutes, buffer_duration_minutes, rest_start_time, rest_end_time) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        'Dr. Victoria N. Okorie',
        'University Librarian',
        null,
        JSON.stringify(['Mon', 'Tue', 'Wed', 'Thu', 'Fri']),
        '09:00',
        '17:00',
        30,
        5,
        '13:00',
        '14:00'
      ]
    );
    console.log('Seeded Officials');

    // Seed sample blackout date (e.g. tomorrow + 5 days)
    const getFutureDate = (daysAhead) => {
      const d = new Date();
      d.setDate(d.getDate() + daysAhead);
      if (d.getDay() === 0) d.setDate(d.getDate() + 1);
      if (d.getDay() === 6) d.setDate(d.getDate() + 2);
      return d.toISOString().split('T')[0];
    };
    const dateNextWeek = getFutureDate(5);

    await dbQuery.run(
      `INSERT INTO blackout_dates (official_id, date, reason) VALUES (?, ?, ?)`,
      [vcOfficial.id, dateNextWeek, 'Emergency FULafia Governing Council Meeting']
    );
    console.log('Seeded Blackout Dates');

    // 4. Create Visitors (Student and Staff)
    const visitorStudent = await dbQuery.run(
      `INSERT INTO users (full_name, email, password_hash, role, matric_staff_id) VALUES (?, ?, ?, ?, ?)`,
      ['Shuaib Abdulsalam', 'student@fulafia.edu.ng', passwordHash, 'visitor', '2021/CP/CSC/0033']
    );
    const visitorStaff = await dbQuery.run(
      `INSERT INTO users (full_name, email, password_hash, role, matric_staff_id) VALUES (?, ?, ?, ?, ?)`,
      ['Dr. Kabir Usman', 'staff@fulafia.edu.ng', passwordHash, 'visitor', 'FUL/ST/402']
    );
    console.log('Seeded Visitors (student@fulafia.edu.ng & staff@fulafia.edu.ng)');

    // 5. Create Sample Appointments
    // Get future dates for sample bookings (e.g. tomorrow, next week)

    const dateTomorrow = getFutureDate(1);
    const datePast = new Date();
    datePast.setDate(datePast.getDate() - 1);
    const datePastStr = datePast.toISOString().split('T')[0];

    // Approved appointment with VC
    await dbQuery.run(
      `INSERT INTO appointments (visitor_user_id, official_id, requested_date, requested_time, purpose, status, qr_code_token) 
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        visitorStudent.id,
        vcOfficial.id,
        dateTomorrow,
        '10:00',
        'Discussion on final year project resource allocation',
        'approved',
        'token_vc_tomorrow_1000'
      ]
    );

    // Pending appointment with Registrar
    await dbQuery.run(
      `INSERT INTO appointments (visitor_user_id, official_id, requested_date, requested_time, purpose, status) 
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        visitorStaff.id,
        regOfficial.id,
        dateTomorrow,
        '11:30',
        'Signing of staff development allowance papers',
        'pending'
      ]
    );

    // Rescheduled appointment with Dean
    await dbQuery.run(
      `INSERT INTO appointments (visitor_user_id, official_id, requested_date, requested_time, purpose, status, rescheduled_date, rescheduled_time, secretary_note) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        visitorStudent.id,
        deanOfficial.id,
        dateTomorrow,
        '14:00',
        'Course registration unit overlap issue review',
        'rescheduled',
        dateNextWeek,
        '11:00',
        'The Dean will be attending an emergency senate meeting at 14:00. Please accept this rescheduled morning slot.'
      ]
    );

    // Completed appointment (in the past)
    await dbQuery.run(
      `INSERT INTO appointments (visitor_user_id, official_id, requested_date, requested_time, purpose, status) 
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        visitorStudent.id,
        vcOfficial.id,
        datePastStr,
        '14:30',
        'Briefing on computer science department student week',
        'completed'
      ]
    );

    console.log('Seeded Sample Appointments');

    // 6. Seed in-app Notifications for visitors and secretaries
    await dbQuery.run(
      `INSERT INTO notifications (user_id, message, is_read) VALUES (?, ?, ?)`,
      [
        vcSecUser.id,
        'New appointment booking request submitted by Shuaib Abdulsalam for Prof. Shehu Abdul Rahman.',
        0
      ]
    );
    await dbQuery.run(
      `INSERT INTO notifications (user_id, message, is_read) VALUES (?, ?, ?)`,
      [
        visitorStudent.id,
        'Your appointment request with Prof. Shehu Abdul Rahman has been approved. Access your QR confirmation slip.',
        0
      ]
    );

    console.log('Seeded Notifications');
    console.log('Database seeding completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('Error seeding database:', error);
    process.exit(1);
  }
}

seed();
