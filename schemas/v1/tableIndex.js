// Table Management System Schema Index
// ไฟล์นี้ export schemas ทั้งหมดที่เกี่ยวข้องกับระบบโต๊ะ

const Table = require('./table.schema');
const TableLayout = require('./tableLayout.schema');
const TableReservation = require('./tableReservation.schema');

module.exports = {
  Table,
  TableLayout,
  TableReservation
};

// Export แยกสำหรับ backward compatibility
module.exports.TableSchema = Table;
module.exports.TableLayoutSchema = TableLayout;
module.exports.TableReservationSchema = TableReservation;

