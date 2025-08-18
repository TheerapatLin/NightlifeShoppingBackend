const TableLayout = require('../schemas/v1/tableLayout.schema');
const Table = require('../schemas/v1/table.schema');
const Venue = require('../schemas/v1/venue.schema');

// สร้าง layout ใหม่
const createTableLayout = async (req, res) => {
  try {
    const {
      name,
      venueId,
      floor,
      layoutType,
      dimensions,
      viewSettings,
      elements,
      description,
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

    // สร้าง layout ใหม่
    const layout = new TableLayout({
      name,
      venueId,
      floor,
      layoutType,
      dimensions,
      viewSettings,
      elements: elements || [],
      description,
      notes,
      createdBy: req.user?._id
    });

    await layout.save();

    res.status(201).json({
      success: true,
      message: 'Table layout created successfully',
      data: layout
    });

  } catch (error) {
    console.error('Error creating table layout:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

// ดึง layouts ทั้งหมดของ venue
const getLayoutsByVenue = async (req, res) => {
  try {
    const { venueId } = req.params;
    const { floor, status, isDefault } = req.query;

    // ตรวจสอบว่า venue มีอยู่จริง
    const venue = await Venue.findById(venueId);
    if (!venue) {
      return res.status(404).json({
        success: false,
        message: 'Venue not found'
      });
    }

    const options = {};
    if (floor !== undefined) options.floor = parseInt(floor);
    if (status) options.status = status;
    if (isDefault !== undefined) options.isDefault = isDefault === 'true';

    const layouts = await TableLayout.findByVenue(venueId, options);

    res.status(200).json({
      success: true,
      message: 'Table layouts retrieved successfully',
      data: layouts,
      total: layouts.length
    });

  } catch (error) {
    console.error('Error getting layouts by venue:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

// ดึง default layout ของ venue
const getDefaultLayout = async (req, res) => {
  try {
    const { venueId } = req.params;
    const { floor = 1 } = req.query;

    const layout = await TableLayout.findDefaultByVenue(venueId, parseInt(floor));

    if (!layout) {
      return res.status(404).json({
        success: false,
        message: 'Default layout not found for this venue and floor'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Default layout retrieved successfully',
      data: layout
    });

  } catch (error) {
    console.error('Error getting default layout:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

// ดึง layout ตาม ID
const getLayoutById = async (req, res) => {
  try {
    const { layoutId } = req.params;

    const layout = await TableLayout.findById(layoutId)
      .populate('venueId', 'name nameTH nameEN')
      .populate('createdBy', 'user.name user.email');

    if (!layout) {
      return res.status(404).json({
        success: false,
        message: 'Layout not found'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Layout retrieved successfully',
      data: layout
    });

  } catch (error) {
    console.error('Error getting layout by ID:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

// ดึง layout พร้อมข้อมูลโต๊ะ
const getLayoutWithTables = async (req, res) => {
  try {
    const { layoutId } = req.params;

    const layout = await TableLayout.findById(layoutId);
    if (!layout) {
      return res.status(404).json({
        success: false,
        message: 'Layout not found'
      });
    }

    // ดึงข้อมูลโต๊ะที่เกี่ยวข้อง
    const tableIds = layout.elements
      .filter(el => el.type === 'table' && el.tableData.tableId)
      .map(el => el.tableData.tableId);

    const tables = await Table.find({ _id: { $in: tableIds } });
    const tableMap = {};
    tables.forEach(table => {
      tableMap[table._id.toString()] = table;
    });

    // เพิ่มข้อมูลโต๊ะเข้าไปใน elements
    const enrichedLayout = layout.toObject();
    enrichedLayout.elements = enrichedLayout.elements.map(element => {
      if (element.type === 'table' && element.tableData.tableId) {
        const table = tableMap[element.tableData.tableId.toString()];
        if (table) {
          element.tableData.fullTableInfo = table;
        }
      }
      return element;
    });

    res.status(200).json({
      success: true,
      message: 'Layout with tables retrieved successfully',
      data: enrichedLayout
    });

  } catch (error) {
    console.error('Error getting layout with tables:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

// อัปเดต layout
const updateLayout = async (req, res) => {
  try {
    const { layoutId } = req.params;
    const updateData = req.body;

    // ตรวจสอบว่า layout มีอยู่จริง
    const existingLayout = await TableLayout.findById(layoutId);
    if (!existingLayout) {
      return res.status(404).json({
        success: false,
        message: 'Layout not found'
      });
    }

    // อัปเดต layout
    const updatedLayout = await TableLayout.findByIdAndUpdate(
      layoutId,
      {
        ...updateData,
        updatedBy: req.user?._id
      },
      { new: true, runValidators: true }
    );

    res.status(200).json({
      success: true,
      message: 'Layout updated successfully',
      data: updatedLayout
    });

  } catch (error) {
    console.error('Error updating layout:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

// ลบ layout
const deleteLayout = async (req, res) => {
  try {
    const { layoutId } = req.params;

    // ตรวจสอบว่า layout มีอยู่จริง
    const layout = await TableLayout.findById(layoutId);
    if (!layout) {
      return res.status(404).json({
        success: false,
        message: 'Layout not found'
      });
    }

    // ไม่ให้ลบ default layout
    if (layout.isDefault) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete default layout'
      });
    }

    // ลบ layout
    await TableLayout.findByIdAndDelete(layoutId);

    res.status(200).json({
      success: true,
      message: 'Layout deleted successfully'
    });

  } catch (error) {
    console.error('Error deleting layout:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

// เพิ่ม element ใน layout
const addElementToLayout = async (req, res) => {
  try {
    const { layoutId } = req.params;
    const elementData = req.body;

    // ตรวจสอบว่า layout มีอยู่จริง
    const layout = await TableLayout.findById(layoutId);
    if (!layout) {
      return res.status(404).json({
        success: false,
        message: 'Layout not found'
      });
    }

    // เพิ่ม element
    await layout.addElement(elementData);

    res.status(200).json({
      success: true,
      message: 'Element added to layout successfully',
      data: layout
    });

  } catch (error) {
    console.error('Error adding element to layout:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

// อัปเดต element ใน layout
const updateElementInLayout = async (req, res) => {
  try {
    const { layoutId, elementId } = req.params;
    const updateData = req.body;

    // ตรวจสอบว่า layout มีอยู่จริง
    const layout = await TableLayout.findById(layoutId);
    if (!layout) {
      return res.status(404).json({
        success: false,
        message: 'Layout not found'
      });
    }

    // อัปเดต element
    await layout.updateElement(elementId, updateData);

    res.status(200).json({
      success: true,
      message: 'Element updated successfully',
      data: layout
    });

  } catch (error) {
    console.error('Error updating element in layout:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

// ลบ element จาก layout
const removeElementFromLayout = async (req, res) => {
  try {
    const { layoutId, elementId } = req.params;

    // ตรวจสอบว่า layout มีอยู่จริง
    const layout = await TableLayout.findById(layoutId);
    if (!layout) {
      return res.status(404).json({
        success: false,
        message: 'Layout not found'
      });
    }

    // ลบ element
    await layout.removeElement(elementId);

    res.status(200).json({
      success: true,
      message: 'Element removed from layout successfully',
      data: layout
    });

  } catch (error) {
    console.error('Error removing element from layout:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

// ทำสำเนา layout
const duplicateLayout = async (req, res) => {
  try {
    const { layoutId } = req.params;
    const { name } = req.body;

    // ตรวจสอบว่า layout มีอยู่จริง
    const layout = await TableLayout.findById(layoutId);
    if (!layout) {
      return res.status(404).json({
        success: false,
        message: 'Layout not found'
      });
    }

    // ทำสำเนา layout
    const duplicatedLayout = await layout.duplicate(name);

    res.status(201).json({
      success: true,
      message: 'Layout duplicated successfully',
      data: duplicatedLayout
    });

  } catch (error) {
    console.error('Error duplicating layout:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

// เปิดใช้งาน layout
const activateLayout = async (req, res) => {
  try {
    const { layoutId } = req.params;

    // ตรวจสอบว่า layout มีอยู่จริง
    const layout = await TableLayout.findById(layoutId);
    if (!layout) {
      return res.status(404).json({
        success: false,
        message: 'Layout not found'
      });
    }

    // เปิดใช้งาน layout
    await layout.activate();

    res.status(200).json({
      success: true,
      message: 'Layout activated successfully',
      data: layout
    });

  } catch (error) {
    console.error('Error activating layout:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

// เก็บ layout เข้าคลัง
const archiveLayout = async (req, res) => {
  try {
    const { layoutId } = req.params;

    // ตรวจสอบว่า layout มีอยู่จริง
    const layout = await TableLayout.findById(layoutId);
    if (!layout) {
      return res.status(404).json({
        success: false,
        message: 'Layout not found'
      });
    }

    // เก็บ layout เข้าคลัง
    await layout.archive();

    res.status(200).json({
      success: true,
      message: 'Layout archived successfully',
      data: layout
    });

  } catch (error) {
    console.error('Error archiving layout:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

module.exports = {
  createTableLayout,
  getLayoutsByVenue,
  getDefaultLayout,
  getLayoutById,
  getLayoutWithTables,
  updateLayout,
  deleteLayout,
  addElementToLayout,
  updateElementInLayout,
  removeElementFromLayout,
  duplicateLayout,
  activateLayout,
  archiveLayout
};