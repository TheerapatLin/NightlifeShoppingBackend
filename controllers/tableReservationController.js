const TableReservation = require('../schemas/v1/tableReservation.schema');
const Table = require('../schemas/v1/table.schema');
const Venue = require('../schemas/v1/venue.schema');

// สร้างการจองใหม่
const createReservation = async (req, res) => {
  try {
    const {
      venueId,
      tableId,
      customerInfo,
      reservationDetails,
      payment,
      source,
      sourceDetails,
      notes,
      publicNotes
    } = req.body;

    // ตรวจสอบว่า venue และ table มีอยู่จริง
    const venue = await Venue.findById(venueId);
    if (!venue) {
      return res.status(404).json({
        success: false,
        message: 'Venue not found'
      });
    }

    const table = await Table.findById(tableId);
    if (!table) {
      return res.status(404).json({
        success: false,
        message: 'Table not found'
      });
    }

    // ตรวจสอบว่าโต๊ะสามารถรองรับจำนวนแขกได้
    if (!table.canAccommodate(reservationDetails.guestCount.total)) {
      return res.status(400).json({
        success: false,
        message: `Table capacity (${table.capacity.min}-${table.capacity.max}) cannot accommodate ${reservationDetails.guestCount.total} guests`
      });
    }

    // ตรวจสอบ time conflicts
    const conflicts = await TableReservation.findConflicts(
      tableId,
      reservationDetails.date,
      reservationDetails.timeSlot.start,
      reservationDetails.timeSlot.end
    );

    if (conflicts.length > 0) {
      return res.status(409).json({
        success: false,
        message: 'Table is not available at the requested time',
        conflicts: conflicts.map(c => ({
          reservationNumber: c.reservationNumber,
          timeSlot: c.reservationDetails.timeSlot,
          status: c.status
        }))
      });
    }

    // สร้างการจองใหม่
    const reservation = new TableReservation({
      venueId,
      tableId,
      userId: req.user?._id,
      customerInfo,
      reservationDetails,
      payment,
      source,
      sourceDetails,
      notes,
      publicNotes,
      createdBy: req.user?._id
    });

    await reservation.save();

    res.status(201).json({
      success: true,
      message: 'Reservation created successfully',
      data: reservation
    });

  } catch (error) {
    console.error('Error creating reservation:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

// ดึงการจองทั้งหมดของ venue
const getReservationsByVenue = async (req, res) => {
  try {
    const { venueId } = req.params;
    const { date, status, tableId } = req.query;

    // ตรวจสอบว่า venue มีอยู่จริง
    const venue = await Venue.findById(venueId);
    if (!venue) {
      return res.status(404).json({
        success: false,
        message: 'Venue not found'
      });
    }

    let reservations;
    if (date) {
      reservations = await TableReservation.findByVenue(venueId, new Date(date));
    } else {
      reservations = await TableReservation.findByVenue(venueId);
    }

    // กรองตาม status ถ้ามี
    if (status) {
      reservations = reservations.filter(r => r.status === status);
    }

    // กรองตาม tableId ถ้ามี
    if (tableId) {
      reservations = reservations.filter(r => r.tableId.toString() === tableId);
    }

    res.status(200).json({
      success: true,
      message: 'Reservations retrieved successfully',
      data: reservations,
      total: reservations.length
    });

  } catch (error) {
    console.error('Error getting reservations by venue:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

// ดึงการจองทั้งหมดของโต๊ะ
const getReservationsByTable = async (req, res) => {
  try {
    const { tableId } = req.params;
    const { date } = req.query;

    // ตรวจสอบว่า table มีอยู่จริง
    const table = await Table.findById(tableId);
    if (!table) {
      return res.status(404).json({
        success: false,
        message: 'Table not found'
      });
    }

    let reservations;
    if (date) {
      reservations = await TableReservation.findByTable(tableId, new Date(date));
    } else {
      reservations = await TableReservation.findByTable(tableId);
    }

    res.status(200).json({
      success: true,
      message: 'Table reservations retrieved successfully',
      data: reservations,
      total: reservations.length
    });

  } catch (error) {
    console.error('Error getting reservations by table:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

// ดึงการจองทั้งหมดของ user
const getReservationsByUser = async (req, res) => {
  try {
    const { userId } = req.params;

    const reservations = await TableReservation.findByUser(userId);

    res.status(200).json({
      success: true,
      message: 'User reservations retrieved successfully',
      data: reservations,
      total: reservations.length
    });

  } catch (error) {
    console.error('Error getting reservations by user:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

// ดึงการจองตาม ID
const getReservationById = async (req, res) => {
  try {
    const { reservationId } = req.params;

    const reservation = await TableReservation.findById(reservationId)
      .populate('venueId', 'name nameTH nameEN location')
      .populate('tableId', 'tableNumber name capacity location')
      .populate('userId', 'user.name user.email user.phone')
      .populate('createdBy', 'user.name user.email');

    if (!reservation) {
      return res.status(404).json({
        success: false,
        message: 'Reservation not found'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Reservation retrieved successfully',
      data: reservation
    });

  } catch (error) {
    console.error('Error getting reservation by ID:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

// อัปเดตการจอง
const updateReservation = async (req, res) => {
  try {
    const { reservationId } = req.params;
    const updateData = req.body;

    // ตรวจสอบว่าการจองมีอยู่จริง
    const existingReservation = await TableReservation.findById(reservationId);
    if (!existingReservation) {
      return res.status(404).json({
        success: false,
        message: 'Reservation not found'
      });
    }

    // ตรวจสอบว่าสามารถแก้ไขได้หรือไม่
    if (['completed', 'cancelled'].includes(existingReservation.status)) {
      return res.status(400).json({
        success: false,
        message: 'Cannot update completed or cancelled reservation'
      });
    }

    // อัปเดตการจอง
    const updatedReservation = await TableReservation.findByIdAndUpdate(
      reservationId,
      {
        ...updateData,
        updatedBy: req.user?._id
      },
      { new: true, runValidators: true }
    );

    res.status(200).json({
      success: true,
      message: 'Reservation updated successfully',
      data: updatedReservation
    });

  } catch (error) {
    console.error('Error updating reservation:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

// ยืนยันการจอง
const confirmReservation = async (req, res) => {
  try {
    const { reservationId } = req.params;

    // ตรวจสอบว่าการจองมีอยู่จริง
    const reservation = await TableReservation.findById(reservationId);
    if (!reservation) {
      return res.status(404).json({
        success: false,
        message: 'Reservation not found'
      });
    }

    // ยืนยันการจอง
    await reservation.confirm(req.user?._id);

    res.status(200).json({
      success: true,
      message: 'Reservation confirmed successfully',
      data: reservation
    });

  } catch (error) {
    console.error('Error confirming reservation:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

// นั่งแขก
const seatGuests = async (req, res) => {
  try {
    const { reservationId } = req.params;

    // ตรวจสอบว่าการจองมีอยู่จริง
    const reservation = await TableReservation.findById(reservationId);
    if (!reservation) {
      return res.status(404).json({
        success: false,
        message: 'Reservation not found'
      });
    }

    // นั่งแขก
    await reservation.seat(req.user?._id);

    res.status(200).json({
      success: true,
      message: 'Guests seated successfully',
      data: reservation
    });

  } catch (error) {
    console.error('Error seating guests:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

// จบการจอง
const completeReservation = async (req, res) => {
  try {
    const { reservationId } = req.params;

    // ตรวจสอบว่าการจองมีอยู่จริง
    const reservation = await TableReservation.findById(reservationId);
    if (!reservation) {
      return res.status(404).json({
        success: false,
        message: 'Reservation not found'
      });
    }

    // จบการจอง
    await reservation.complete(req.user?._id);

    res.status(200).json({
      success: true,
      message: 'Reservation completed successfully',
      data: reservation
    });

  } catch (error) {
    console.error('Error completing reservation:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

// ยกเลิกการจอง
const cancelReservation = async (req, res) => {
  try {
    const { reservationId } = req.params;
    const { reason, refundAmount = 0 } = req.body;

    // ตรวจสอบว่าการจองมีอยู่จริง
    const reservation = await TableReservation.findById(reservationId);
    if (!reservation) {
      return res.status(404).json({
        success: false,
        message: 'Reservation not found'
      });
    }

    // ยกเลิกการจอง
    await reservation.cancel(reason, req.user?._id, refundAmount);

    res.status(200).json({
      success: true,
      message: 'Reservation cancelled successfully',
      data: reservation
    });

  } catch (error) {
    console.error('Error cancelling reservation:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

// ย้ายโต๊ะ
const moveTable = async (req, res) => {
  try {
    const { reservationId } = req.params;
    const { newTableId, reason } = req.body;

    // ตรวจสอบว่าการจองมีอยู่จริง
    const reservation = await TableReservation.findById(reservationId);
    if (!reservation) {
      return res.status(404).json({
        success: false,
        message: 'Reservation not found'
      });
    }

    // ตรวจสอบว่าโต๊ะใหม่มีอยู่จริง
    const newTable = await Table.findById(newTableId);
    if (!newTable) {
      return res.status(404).json({
        success: false,
        message: 'New table not found'
      });
    }

    // ย้ายโต๊ะ
    await reservation.moveTable(newTableId, reason, req.user?._id);

    res.status(200).json({
      success: true,
      message: 'Table moved successfully',
      data: reservation
    });

  } catch (error) {
    console.error('Error moving table:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

// ขยายเวลา
const extendReservation = async (req, res) => {
  try {
    const { reservationId } = req.params;
    const { additionalMinutes, reason } = req.body;

    // ตรวจสอบว่าการจองมีอยู่จริง
    const reservation = await TableReservation.findById(reservationId);
    if (!reservation) {
      return res.status(404).json({
        success: false,
        message: 'Reservation not found'
      });
    }

    // ขยายเวลา
    await reservation.extend(additionalMinutes, reason, req.user?._id);

    res.status(200).json({
      success: true,
      message: 'Reservation extended successfully',
      data: reservation
    });

  } catch (error) {
    console.error('Error extending reservation:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

// ดึงสถิติการจอง
const getReservationStats = async (req, res) => {
  try {
    const { venueId } = req.params;
    const { date, period = 'day' } = req.query;

    // ตรวจสอบว่า venue มีอยู่จริง
    const venue = await Venue.findById(venueId);
    if (!venue) {
      return res.status(404).json({
        success: false,
        message: 'Venue not found'
      });
    }

    // กำหนดช่วงเวลา
    let startDate, endDate;
    if (date) {
      const targetDate = new Date(date);
      if (period === 'day') {
        startDate = new Date(targetDate);
        startDate.setHours(0, 0, 0, 0);
        endDate = new Date(targetDate);
        endDate.setHours(23, 59, 59, 999);
      } else if (period === 'week') {
        startDate = new Date(targetDate);
        startDate.setDate(targetDate.getDate() - targetDate.getDay());
        startDate.setHours(0, 0, 0, 0);
        endDate = new Date(startDate);
        endDate.setDate(startDate.getDate() + 6);
        endDate.setHours(23, 59, 59, 999);
      } else if (period === 'month') {
        startDate = new Date(targetDate.getFullYear(), targetDate.getMonth(), 1);
        endDate = new Date(targetDate.getFullYear(), targetDate.getMonth() + 1, 0);
        endDate.setHours(23, 59, 59, 999);
      }
    }

    // Query สำหรับการจอง
    const query = { venueId };
    if (startDate && endDate) {
      query['reservationDetails.date'] = {
        $gte: startDate,
        $lte: endDate
      };
    }

    const reservations = await TableReservation.find(query);

    // คำนวณสถิติ
    const stats = {
      total: reservations.length,
      byStatus: {
        pending: 0,
        confirmed: 0,
        seated: 0,
        completed: 0,
        cancelled: 0,
        'no-show': 0
      },
      bySource: {},
      totalGuests: 0,
      averagePartySize: 0,
      revenue: {
        deposits: 0,
        minimumSpend: 0
      }
    };

    reservations.forEach(reservation => {
      // นับตาม status
      stats.byStatus[reservation.status]++;
      
      // นับตาม source
      stats.bySource[reservation.source] = (stats.bySource[reservation.source] || 0) + 1;
      
      // รวมจำนวนแขก
      stats.totalGuests += reservation.reservationDetails.guestCount.total;
      
      // รวมรายได้
      if (reservation.payment.depositPaid) {
        stats.revenue.deposits += reservation.payment.depositAmount || 0;
      }
      stats.revenue.minimumSpend += reservation.payment.minimumSpend || 0;
    });

    // คำนวณค่าเฉลี่ย
    if (reservations.length > 0) {
      stats.averagePartySize = Math.round((stats.totalGuests / reservations.length) * 100) / 100;
    }

    res.status(200).json({
      success: true,
      message: 'Reservation statistics retrieved successfully',
      data: stats,
      period: {
        type: period,
        startDate,
        endDate
      }
    });

  } catch (error) {
    console.error('Error getting reservation statistics:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

module.exports = {
  createReservation,
  getReservationsByVenue,
  getReservationsByTable,
  getReservationsByUser,
  getReservationById,
  updateReservation,
  confirmReservation,
  seatGuests,
  completeReservation,
  cancelReservation,
  moveTable,
  extendReservation,
  getReservationStats
};