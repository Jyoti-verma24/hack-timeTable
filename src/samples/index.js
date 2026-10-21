// Demo colleges. They exist only so people can try the app in one click;
// a real college replaces them with its own data.

import { parseSlots } from '../io/slots.js';

const WEEK = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function periods(start, minutes, count, lunchAfter, lunchMinutes) {
  const out = [];
  let t = toMin(start);
  for (let i = 0; i < count; i++) {
    if (i === lunchAfter) t += lunchMinutes;
    out.push({ label: `P${i + 1}`, start: fromMin(t), end: fromMin(t + minutes) });
    t += minutes;
  }
  return out;
}
const toMin = (hhmm) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3));
const fromMin = (m) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;

function teacher(id, name, dept, maxPerWeek, maxPerDay, unavailable = '') {
  return { id, name, dept, maxPerWeek, maxPerDay, unavailable: parseSlots(unavailable, WEEK).slots };
}

function loadBuilder() {
  let n = 0;
  return (section, subject, teacherId, hours, opts = {}) => ({
    id: `L${++n}`,
    section,
    subject,
    teacher: teacherId,
    type: opts.lab ? 'lab' : 'theory',
    hours,
    block: opts.block || (opts.lab ? 2 : 1),
    roomType: opts.room || 'classroom',
  });
}

function engineering() {
  const L = loadBuilder();
  const lab = (room, block = 2) => ({ lab: true, room, block });
  return {
    settings: {
      name: 'Sample Engineering College, Ludhiana',
      days: WEEK,
      periods: periods('09:00', 50, 8, 4, 40),
      lunchAfter: 4,
      halfDays: { Sat: 4 },
      fixedSlots: [{ day: 'Fri', period: 7, label: 'Sports / Clubs' }],
    },
    departments: [
      { id: 'CSE', name: 'Computer Science & Engineering', hod: 'Dr. Harpreet Kaur' },
      { id: 'ECE', name: 'Electronics & Communication', hod: 'Dr. Gurpreet Sandhu' },
      { id: 'ME', name: 'Mechanical Engineering', hod: 'Dr. Jaswinder Brar' },
      { id: 'ASH', name: 'Applied Sciences & Humanities', hod: 'Dr. Meenakshi Gupta' },
    ],
    rooms: [
      { id: 'CR-101', type: 'classroom', capacity: 70, dept: 'CSE' },
      { id: 'CR-102', type: 'classroom', capacity: 70, dept: 'CSE' },
      { id: 'CR-103', type: 'classroom', capacity: 60, dept: 'CSE' },
      { id: 'CR-201', type: 'classroom', capacity: 70, dept: 'ECE' },
      { id: 'CR-202', type: 'classroom', capacity: 60, dept: 'ECE' },
      { id: 'CR-301', type: 'classroom', capacity: 70, dept: 'ME' },
      { id: 'CR-302', type: 'classroom', capacity: 60, dept: 'ME' },
      { id: 'Seminar Hall', type: 'hall', capacity: 150, dept: 'shared' },
      { id: 'Computer Lab 1', type: 'computer-lab', capacity: 60, dept: 'CSE' },
      { id: 'Computer Lab 2', type: 'computer-lab', capacity: 60, dept: 'shared' },
      { id: 'Electronics Lab', type: 'electronics-lab', capacity: 60, dept: 'ECE' },
      { id: 'Workshop', type: 'mech-lab', capacity: 60, dept: 'ME' },
      { id: 'Physics Lab', type: 'physics-lab', capacity: 60, dept: 'shared' },
    ],
    teachers: [
      teacher('C01', 'Dr. Harpreet Kaur', 'CSE', 14, 4, 'Fri 5-8'),
      teacher('C02', 'Prof. Amandeep Singh', 'CSE', 18, 4),
      teacher('C03', 'Dr. Neha Sharma', 'CSE', 18, 4),
      teacher('C04', 'Mr. Rajat Verma', 'CSE', 18, 4),
      teacher('C05', 'Ms. Simran Gill', 'CSE', 18, 4),
      teacher('E01', 'Dr. Gurpreet Sandhu', 'ECE', 14, 4),
      teacher('E02', 'Prof. Manish Arora', 'ECE', 18, 4, 'Mon 1-2'),
      teacher('E03', 'Ms. Kavita Bansal', 'ECE', 18, 4),
      teacher('M01', 'Dr. Jaswinder Brar', 'ME', 14, 4),
      teacher('M02', 'Prof. Vikram Sethi', 'ME', 18, 4),
      teacher('M03', 'Mr. Rohit Malhotra', 'ME', 18, 4),
      teacher('A01', 'Dr. Meenakshi Gupta', 'ASH', 14, 4),
      teacher('A02', 'Prof. Balwinder Dhillon', 'ASH', 18, 4),
      teacher('A03', 'Dr. Ritu Chawla', 'ASH', 18, 4),
      teacher('A04', 'Ms. Pooja Khanna', 'ASH', 12, 3, 'Sat 1-4; Wed 5-8'),
    ],
    sections: [
      { id: 'CSE-3A', dept: 'CSE', semester: 3, students: 60 },
      { id: 'CSE-3B', dept: 'CSE', semester: 3, students: 58 },
      { id: 'CSE-5A', dept: 'CSE', semester: 5, students: 55 },
      { id: 'ECE-3A', dept: 'ECE', semester: 3, students: 60 },
      { id: 'ECE-5A', dept: 'ECE', semester: 5, students: 50 },
      { id: 'ME-3A', dept: 'ME', semester: 3, students: 55 },
      { id: 'ME-5A', dept: 'ME', semester: 5, students: 45 },
    ],
    load: [
      L('CSE-3A', 'Data Structures', 'C01', 4),
      L('CSE-3A', 'Discrete Mathematics', 'A01', 4),
      L('CSE-3A', 'Digital Electronics', 'E02', 3),
      L('CSE-3A', 'OOP with Java', 'C02', 4),
      L('CSE-3A', 'Data Structures Lab', 'C01', 2, lab('computer-lab')),
      L('CSE-3A', 'Java Lab', 'C02', 2, lab('computer-lab')),
      L('CSE-3A', 'Communication Skills', 'A04', 2),

      L('CSE-3B', 'Data Structures', 'C03', 4),
      L('CSE-3B', 'Discrete Mathematics', 'A02', 4),
      L('CSE-3B', 'Digital Electronics', 'E02', 3),
      L('CSE-3B', 'OOP with Java', 'C04', 4),
      L('CSE-3B', 'Data Structures Lab', 'C03', 2, lab('computer-lab')),
      L('CSE-3B', 'Java Lab', 'C04', 2, lab('computer-lab')),
      L('CSE-3B', 'Communication Skills', 'A04', 2),

      L('CSE-5A', 'Database Systems', 'C05', 4),
      L('CSE-5A', 'Operating Systems', 'C01', 4),
      L('CSE-5A', 'Computer Networks', 'C02', 4),
      L('CSE-5A', 'Software Engineering', 'C03', 3),
      L('CSE-5A', 'DBMS Lab', 'C05', 3, lab('computer-lab', 3)),
      L('CSE-5A', 'Operating Systems Lab', 'C01', 2, lab('computer-lab')),

      L('ECE-3A', 'Signals & Systems', 'E01', 4),
      L('ECE-3A', 'Analog Electronics', 'E03', 4),
      L('ECE-3A', 'Engineering Mathematics III', 'A01', 4),
      L('ECE-3A', 'Digital Electronics', 'E02', 3),
      L('ECE-3A', 'Analog Electronics Lab', 'E03', 2, lab('electronics-lab')),
      L('ECE-3A', 'Physics Lab', 'A03', 2, lab('physics-lab')),
      L('ECE-3A', 'Communication Skills', 'A04', 2),

      L('ECE-5A', 'Microprocessors', 'E01', 4),
      L('ECE-5A', 'Communication Systems', 'E02', 4),
      L('ECE-5A', 'VLSI Design', 'E03', 3),
      L('ECE-5A', 'Microprocessor Lab', 'E01', 3, lab('electronics-lab', 3)),
      L('ECE-5A', 'Programming in C', 'C04', 3),
      L('ECE-5A', 'Engineering Economics', 'A04', 2),

      L('ME-3A', 'Thermodynamics', 'M01', 4),
      L('ME-3A', 'Strength of Materials', 'M02', 4),
      L('ME-3A', 'Engineering Mathematics III', 'A02', 4),
      L('ME-3A', 'Manufacturing Processes', 'M03', 3),
      L('ME-3A', 'Workshop Practice', 'M03', 3, lab('mech-lab', 3)),
      L('ME-3A', 'Physics Lab', 'A03', 2, lab('physics-lab')),
      L('ME-3A', 'Communication Skills', 'A04', 2),

      L('ME-5A', 'Fluid Mechanics', 'M01', 4),
      L('ME-5A', 'Machine Design', 'M02', 4),
      L('ME-5A', 'Heat Transfer', 'M03', 3),
      L('ME-5A', 'Fluid Mechanics Lab', 'M01', 2, lab('mech-lab')),
      L('ME-5A', 'CAD Lab', 'M02', 3, lab('computer-lab', 3)),
      L('ME-5A', 'Industrial Management', 'A02', 2),
    ],
  };
}

function artsCommerce() {
  const L = loadBuilder();
  const days = WEEK;
  return {
    settings: {
      name: 'Sample Arts & Commerce College',
      days,
      periods: periods('09:30', 45, 6, 3, 30),
      lunchAfter: 3,
      halfDays: { Sat: 3 },
      fixedSlots: [{ day: 'Mon', period: 0, label: 'Assembly' }],
    },
    departments: [
      { id: 'COM', name: 'Commerce', hod: 'Dr. Anita Mehra' },
      { id: 'ART', name: 'Arts & Humanities', hod: 'Dr. Sukhwinder Grewal' },
    ],
    rooms: [
      { id: 'Room 1', type: 'classroom', capacity: 50, dept: 'COM' },
      { id: 'Room 2', type: 'classroom', capacity: 50, dept: 'COM' },
      { id: 'Room 3', type: 'classroom', capacity: 50, dept: 'ART' },
      { id: 'Room 4', type: 'classroom', capacity: 50, dept: 'ART' },
      { id: 'Main Hall', type: 'hall', capacity: 120, dept: 'shared' },
      { id: 'Computer Lab', type: 'computer-lab', capacity: 45, dept: 'shared' },
    ],
    teachers: [
      teacher('T1', 'Dr. Anita Mehra', 'COM', 14, 4),
      teacher('T2', 'Mr. Kuldeep Bedi', 'COM', 18, 4),
      teacher('T3', 'Ms. Ramandeep Kaur', 'COM', 18, 4, 'Sat 1-3'),
      teacher('T4', 'Dr. Sukhwinder Grewal', 'ART', 14, 4),
      teacher('T5', 'Prof. Navneet Sidhu', 'ART', 18, 4),
      teacher('T6', 'Ms. Jaspreet Toor', 'ART', 18, 4),
      teacher('T7', 'Mr. Harjit Mann', 'ART', 18, 4, 'Fri 4-6'),
    ],
    sections: [
      { id: 'BCom-1', dept: 'COM', semester: 1, students: 45 },
      { id: 'BCom-3', dept: 'COM', semester: 3, students: 42 },
      { id: 'BA-1', dept: 'ART', semester: 1, students: 48 },
      { id: 'BA-3', dept: 'ART', semester: 3, students: 40 },
    ],
    load: [
      L('BCom-1', 'Financial Accounting', 'T1', 5),
      L('BCom-1', 'Business Economics', 'T2', 4),
      L('BCom-1', 'Business Law', 'T3', 4),
      L('BCom-1', 'English', 'T6', 3),
      L('BCom-1', 'Punjabi', 'T7', 3),
      L('BCom-1', 'Computer Applications', 'T3', 2, { lab: true, room: 'computer-lab' }),

      L('BCom-3', 'Corporate Accounting', 'T1', 5),
      L('BCom-3', 'Income Tax', 'T2', 4),
      L('BCom-3', 'Business Statistics', 'T2', 4),
      L('BCom-3', 'English', 'T6', 3),
      L('BCom-3', 'Punjabi', 'T7', 3),
      L('BCom-3', 'E-Commerce Lab', 'T3', 2, { lab: true, room: 'computer-lab' }),

      L('BA-1', 'History of Punjab', 'T4', 5),
      L('BA-1', 'Political Science', 'T5', 5),
      L('BA-1', 'Economics', 'T2', 3),
      L('BA-1', 'English', 'T6', 3),
      L('BA-1', 'Punjabi', 'T7', 3),

      L('BA-3', 'Modern Indian History', 'T4', 5),
      L('BA-3', 'Public Administration', 'T5', 5),
      L('BA-3', 'Sociology', 'T6', 4),
      L('BA-3', 'Punjabi', 'T7', 3),
      L('BA-3', 'Environmental Studies', 'T5', 2),
    ],
  };
}

export const SAMPLES = [
  { key: 'engineering', label: 'Engineering college (4 departments, labs, shared rooms)', build: engineering },
  { key: 'arts', label: 'Arts & commerce college (2 departments, 6 periods)', build: artsCommerce },
];
