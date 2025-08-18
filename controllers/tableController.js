const Table = require('../schemas/v1/table.schema');
const Venue = require('../schemas/v1/venue.schema');

// สร้างโต๊ะใหม่
const createTable = async (req, res) => {
  try {
    const {
      tableNumber,
      name,
      venueId,
      tableType,
      capacity,
      shape,
      dimensions,
      location,
      features,
      pricing,
      operatingHours,
      description,
      images,
      tags,
      notes
    } = req.body;

    // ตรวจสอบว่า venue มีอยู่จริง
    const venue = await Venue.findById(venueId);
    if (!venue) {
      return res.status(404).json({
        success: false,
        message: 'Venue not found'
      });
    }

    // ตรวจสอบว่า table number ไม่ซ้ำใน venue เดียวกัน
    const existingTable = await Table.findOne({ venueId, tableNumber });
    if (existingTable) {
      return res.status(400).json({
        success: false,
        message: 'Table number already exists in this venue'
      });
    }

    // สร้างโต๊ะใหม่
    const table = new Table({
      tableNumber,
      name,
      venueId,
      tableType,
      capacity,
      shape,
      dimensions,
      location,
      features,
      pricing,
      operatingHours,
      description,
      images,
      tags,
      notes,
      createdBy: req.user?._id
    });

    await table.save();

    res.status(201).json({
      success: true,
      message: 'Table created successfully',
      data: table
    });

  } catch (error) {
    console.error('Error creating table:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

// ดึงโต๊ะทั้งหมดของ venue
const getTablesByVenue = async (req, res) => {
  try {
    const { venueId } = req.params;
    const { 
      status, 
      tableType, 
      isBookable, 
      minCapacity, 
      maxCapacity,
      floor,
      section 
    } = req.query;

    // ตรวจสอบว่า venue มีอยู่จริง
    const venue = await Venue.findById(venueId);
    if (!venue) {
      return res.status(404).json({
        success: false,
        message: 'Venue not found'
      });
    }

    const options = {};
    if (status) options.status = status;
    if (tableType) options.tableType = tableType;
    if (isBookable !== undefined) options.isBookable = isBookable === 'true';
    if (minCapacity) options.minCapacity = parseInt(minCapacity);
    if (maxCapacity) options.maxCapacity = parseInt(maxCapacity);

    const tables = await Table.findByVenue(venueId, options);

    // กรองตาม floor และ section ถ้ามี
    let filteredTables = tables;
    if (floor) {
      filteredTables = filteredTables.filter(table => 
        table.location.floor === parseInt(floor)
      );
    }
    if (section) {
      filteredTables = filteredTables.filter(table => 
        table.location.section === section
      );
    }

    res.status(200).json({
      success: true,
      message: 'Tables retrieved successfully',
      data: filteredTables,
      total: filteredTables.length
    });

  } catch (error) {
    console.error('Error getting tables by venue:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

// ดึงโต๊ะตาม ID
const getTableById = async (req, res) => {
  try {
    const { tableId } = req.params;

    const table = await Table.findById(tableId)
      .populate('venueId', 'name nameTH nameEN type location')
      .populate('createdBy', 'user.name user.email');

    if (!table) {
      return res.status(404).json({
        success: false,
        message: 'Table not found'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Table retrieved successfully',
      data: table
    });

  } catch (error) {
    console.error('Error getting table by ID:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

// อัปเดตโต๊ะ
const updateTable = async (req, res) => {
  try {
    const { tableId } = req.params;
    const updateData = req.body;

    // ตรวจสอบว่าโต๊ะมีอยู่จริง
    const existingTable = await Table.findById(tableId);
    if (!existingTable) {
      return res.status(404).json({
        success: false,
        message: 'Table not found'
      });
    }

    // ตรวจสอบว่า table number ไม่ซ้ำ (ถ้ามีการเปลี่ยน)
    if (updateData.tableNumber && updateData.tableNumber !== existingTable.tableNumber) {
      const conflictingTable = await Table.findOne({
        venueId: existingTable.venueId,
        tableNumber: updateData.tableNumber,
        _id: { $ne: tableId }
      });

      if (conflictingTable) {
        return res.status(400).json({
          success: false,
          message: 'Table number already exists in this venue'
        });
      }
    }

    // อัปเดตโต๊ะ
    const updatedTable = await Table.findByIdAndUpdate(
      tableId,
      {
        ...updateData,
        updatedBy: req.user?._id
      },
      { new: true, runValidators: true }
    );

    res.status(200).json({
      success: true,
      message: 'Table updated successfully',
      data: updatedTable
    });

  } catch (error) {
    console.error('Error updating table:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

// ลบโต๊ะ
const deleteTable = async (req, res) => {
  try {
    const { tableId } = req.params;

    // ตรวจสอบว่าโต๊ะมีอยู่จริง
    const table = await Table.findById(tableId);
    if (!table) {
      return res.status(404).json({
        success: false,
        message: 'Table not found'
      });
    }

    // ลบโต๊ะ
    await Table.findByIdAndDelete(tableId);

    res.status(200).json({
      success: true,
      message: 'Table deleted successfully'
    });

  } catch (error) {
    console.error('Error deleting table:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

// ดึงโต๊ะที่ว่างสำหรับการจอง
const getAvailableTables = async (req, res) => {
  try {
    const { venueId } = req.params;
    const { 
      date, 
      startTime, 
      endTime, 
      numberOfGuests,
      tableType,
      floor,
      section 
    } = req.query;

    // ตรวจสอบ parameters ที่จำเป็น
    if (!date || !startTime || !endTime || !numberOfGuests) {
      return res.status(400).json({
        success: false,
        message: 'Date, start time, end time, and number of guests are required'
      });
    }

    const reservationDate = new Date(date);
    const guests = parseInt(numberOfGuests);

    // ดึงโต๊ะที่สามารถจองได้
    const tables = await Table.find({
      venueId,
      status: 'active',
      isBookable: true
    });

    // กรองตาม capacity
    const suitableTables = tables.filter(table => 
      table.canAccommodate(guests)
    );

    // กรองตาม tableType ถ้ามี
    let filteredTables = suitableTables;
    if (tableType) {
      filteredTables = filteredTables.filter(table => 
        table.tableType === tableType
      );
    }

    // กรองตาม floor ถ้ามี
    if (floor) {
      filteredTables = filteredTables.filter(table => 
        table.location.floor === parseInt(floor)
      );
    }

    // กรองตาม section ถ้ามี
    if (section) {
      filteredTables = filteredTables.filter(table => 
        table.location.section === section
      );
    }

    // สำหรับตอนนี้ ให้ถือว่าโต๊ะทั้งหมดว่าง (จะเพิ่ม logic ตรวจสอบการจองในอนาคต)
    const availableTables = filteredTables.map(table => ({
      ...table.toObject(),
      isAvailable: true,
      availableSlots: [{
        startTime,
        endTime
      }]
    }));

    res.status(200).json({
      success: true,
      message: 'Available tables retrieved successfully',
      data: availableTables,
      total: availableTables.length,
      searchCriteria: {
        date: reservationDate,
        startTime,
        endTime,
        numberOfGuests: guests,
        tableType,
        floor,
        section
      }
    });

  } catch (error) {
    console.error('Error getting available tables:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

// อัปเดตสถานะโต๊ะ
const updateTableStatus = async (req, res) => {
  try {
    const { tableId } = req.params;
    const { status, reason } = req.body;

    // ตรวจสอบว่าโต๊ะมีอยู่จริง
    const table = await Table.findById(tableId);
    if (!table) {
      return res.status(404).json({
        success: false,
        message: 'Table not found'
      });
    }

    // อัปเดตสถานะ
    await table.updateStatus(status, reason);

    res.status(200).json({
      success: true,
      message: 'Table status updated successfully',
      data: table
    });

  } catch (error) {
    console.error('Error updating table status:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

// ดึงสถิติโต๊ะ
const getTableStats = async (req, res) => {
  try {
    const { venueId } = req.params;

    // ดึงโต๊ะทั้งหมดของ venue
    const tables = await Table.findByVenue(venueId);
    
    // คำนวณสถิติ
    const stats = {
      totalTables: tables.length,
      activeTables: tables.filter(t => t.status === 'active').length,
      bookableTables: tables.filter(t => t.isBookable).length,
      tableTypes: {},
      capacityRanges: {
        small: 0,
        medium: 0,
        large: 0,
        'extra-large': 0
      },
      floors: {},
      sections: {}
    };

    // นับตามประเภทโต๊ะ
    tables.forEach(table => {
      stats.tableTypes[table.tableType] = (stats.tableTypes[table.tableType] || 0) + 1;
      stats.capacityRanges[table.capacityStatus]++;
      
      if (table.location.floor) {
        stats.floors[table.location.floor] = (stats.floors[table.location.floor] || 0) + 1;
      }
      
      if (table.location.section) {
        stats.sections[table.location.section] = (stats.sections[table.location.section] || 0) + 1;
      }
    });

    res.status(200).json({
      success: true,
      message: 'Table statistics retrieved successfully',
      data: stats
    });

  } catch (error) {
    console.error('Error getting table statistics:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

module.exports = {
  createTable,
  getTablesByVenue,
  getTableById,
  updateTable,
  deleteTable,
  getAvailableTables,
  updateTableStatus,
  getTableStats
};