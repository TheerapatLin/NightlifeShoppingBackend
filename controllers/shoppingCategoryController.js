const CategoryShopping = require('../schemas/v1/shopping/shopping.categories.schema')
const User = require("../schemas/v1/user.schema");
const mongoose = require("mongoose");

exports.createCategoryShopping = async (req, res) => {
    try {
        const {
            creatorId,
            creatorName,
            slug,
            status,
        } = req.body

        // ตรวจสอบว่ามี creatorId หรือไม่
        if (!creatorId) {
            return res.status(400).send({ error: "ต้องระบุ Creator ID" });
        }

        // ค้นหาผู้สร้างกิจกรรม (creator)
        const user = await User.findById(creatorId).populate(
            "userData",
            "profileImage"
        );
        if (!user) {
            return res
                .status(404)
                .send({ error: "ไม่พบข้อมูลผู้สร้างกิจกรรม (Creator)" });
        }

        if (!slug) {
            return res.status(400).send({ error: "ต้องระบุ slug" });
        }

        let nameData, descriptionData

        nameData = req.body.name
        descriptionData = req.body.description

        const newCategory = new CategoryShopping({
            creator: { id: creatorId, name: creatorName },
            name: {
                en: nameData.en,
                th: nameData.th
            },
            slug: slug,
            description: {
                en: descriptionData.en,
                th: descriptionData.th
            },
            status: status
        })

        const saveCategory = await newCategory.save()

        res.status(200).send({ message: `Create new category successful.` })
    }
    catch (error) {

        // ตรวจสอบว่าเป็น error จาก unique index หรือไม่
        if (error.code === 11000 && error.keyPattern?.slug) {
            return res.status(400).send({ error: "slug นี้ถูกใช้งานแล้ว กรุณาเลือก slug อื่น" });
        }

        res.status(500).send({ error: error.message });
    }
}

exports.getAllCategories = async (req, res) => {
    try {
        const categories = await CategoryShopping.find({})

        if (!categories || categories.length === 0) {
            return res.status(404).json({ message: "ไม่พบ Category" });
        }

        res.status(200).send(categories)

    }
    catch (error) {
        res.status(500).json({ message: error.message });
    }
}

exports.getCategoryById = async (req, res) => {
    try {
        const categoryId = req.params.categoryId

        if (!mongoose.Types.ObjectId.isValid(categoryId)) {
            return res.status(400).json({ message: "ไม่พบ categoryId" });
        }

        const category = await CategoryShopping.findById(categoryId)

        if (!category) {
            return res.status(404).json({ message: "ไม่พบ category" });
        }

        res.status(200).send(category)
    }
    catch (error) {
        res.status(500).json({ message: error.message });
    }
}

exports.getCategoriesByCreatorId = async (req, res) => {
    try {
        const creatorId = req.params.creatorId;

        // ตรวจสอบว่ามี creatorId หรือไม่
        if (!creatorId) {
            return res.status(400).send({ error: "ต้องระบุ creatorId" });
        }

        // ตรวจสอบว่า creatorId เป็น ObjectId ที่ถูกต้องหรือไม่
        if (!mongoose.Types.ObjectId.isValid(creatorId)) {
            return res.status(400).json({ message: "ไม่พบ creatorId ที่ถูกต้อง" });
        }

        const limit = parseInt(req.query.limit) || 0; // ตั้งค่า limit ให้เป็น 0 ถ้าไม่ได้ระบุ เพื่อไม่จำกัดจำนวนข้อมูล

        // ค้นหากิจกรรมที่สร้างโดยผู้ใช้ที่มี id ตรงกับ creatorId
        const categories = await CategoryShopping.find({ "creator.id": creatorId })
            .sort({ createdAt: -1 }) // เรียงลำดับจากใหม่ไปเก่า
            .limit(limit)

        if (!categories || categories.length === 0) {
            return res.status(404).json({ message: "ไม่พบ categories" });
        }

        // ดึงข้อมูลของผู้สร้างกิจกรรม
        const creator = await User.findById(creatorId)
            .populate({
                path: "userData", // เติมข้อมูล `userData` ของผู้สร้าง
                model: "RegularUserData",
                select: "profileImage", // เลือกรูปโปรไฟล์
            })
            .select("user.name userData"); // เลือกเฉพาะฟิลด์ชื่อผู้ใช้และ `userData`

        if (!creator) {
            return res.status(404).json({ message: "ไม่พบข้อมูลผู้สร้าง categories" });
        }

        // จัดรูปแบบข้อมูลกิจกรรมพร้อมข้อมูลผู้สร้างและผู้เข้าร่วม
        const categoriesWithCreatorInfo = categories.map((category) => {
            return {
                ...category.toObject(),
                creator: {
                    id: creator._id, // id ของผู้สร้าง
                    name: creator.user.name, // ชื่อผู้สร้าง
                    profileImage: creator.userData
                        ? creator.userData.profileImage || "" // รูปโปรไฟล์ของผู้สร้าง (ถ้าไม่มีให้ใช้ค่าว่าง)
                        : "",
                },
            };
        });

        res.status(200).send(categoriesWithCreatorInfo)
    }
    catch (error) {
        res.status(500).json({ message: error.message });
    }
}

exports.editCategory = async (req, res) => {
    try {
        const { categoryId } = req.params
        const { creatorId } = req.body

        // ตรวจสอบว่ามี creatorId หรือไม่
        if (!creatorId) {
            return res.status(400).send({ error: "ต้องระบุ creatorId" });
        }

        const existingCategory = await CategoryShopping.findById(categoryId);

        if (!existingCategory) {
            return res.status(404).send({ error: "categoryId not found" });
        }

        if (existingCategory.creator.id.toString() !== creatorId) {
            return res
                .status(403)
                .send({ error: "You can only edit your own category." });
        }

        try {
            const fieldsToUpdate = [
                "name",
                "slug",
                "description",
                "status",
            ];
            fieldsToUpdate.forEach((field) => {
                if (req.body[field] !== undefined) {
                    existingCategory[field] = req.body[field];
                }
            });
        } catch (error) {
            console.error("Failed to update the category:", error);
            // ส่ง response กลับไปยัง client ว่ามีข้อผิดพลาดเกิดขึ้น
            res.status(500).send({
                message: "Error updating the category (mayby type of datas mismatched)",
                error: error.toString(),
            });
        }

        existingCategory.updatedAt = new Date();
        await existingCategory.save();

        res.status(200).json({ message: "Category updated successfully" });
    }
    catch (error) {

        // ตรวจสอบว่าเป็น error จาก unique index หรือไม่
        if (error.code === 11000 && error.keyPattern?.slug) {
            return res.status(400).send({ error: "slug นี้ถูกใช้งานแล้ว กรุณาเลือก slug อื่น" });
        }

        res.status(500).json({ message: error.message });
    }
}

exports.deleteCategory = async (req, res) => {
    try {
        const category = await CategoryShopping.findByIdAndDelete(req.params.categoryId);

        if (!category) {
            return res.status(404).json({ message: "Category not found" });
        }

        res.status(200).json({ message: "Category deleted successfully" });
    }
    catch (error) {
        res.status(500).json({ message: error.message });
    }
}