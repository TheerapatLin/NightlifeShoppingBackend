const nodemailer = require("nodemailer");
const ProductShopping = require("../../schemas/v1/shopping/shopping.products.schema")

function formatDateThai(dateInput) {
    if (!dateInput) return "ไม่ระบุ";
    const d = new Date(dateInput);
    return d.toLocaleString("th-TH", {
        timeZone: "Asia/Bangkok",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
    });
}

function formatBaht(amount) {
    if (amount === undefined || amount === null) return "ไม่ระบุ";
    return `${Number(amount).toLocaleString("th-TH")} บาท`;
}

function toPlain(doc) {
    return (
        doc?.toObject?.({ getters: true, virtuals: false }) ||
        doc?._doc ||
        doc ||
        {}
    );
}
function get(obj, key) {
    return obj?.get ? obj.get(key) : obj?.[key];
}

module.exports = async function sendOrderShoppingBillEmail(
    orderDoc,
    userDoc,
) {
    try {
        const recipients = process.env.MAIN_EMAILS
            ? process.env.MAIN_EMAILS.split(",")
                .map((e) => e.trim())
                .filter(Boolean)
            : [];
        if (recipients.length === 0) {
            console.error("❌ MAIN_EMAILS ว่าง: โปรดกำหนดใน .env");
            return;
        }

        const transporter = nodemailer.createTransport({
            host: process.env.MAIL_HOST,
            port: Number(process.env.MAIL_PORT) || 465,
            secure: true,
            auth: {
                user: process.env.MAIL_USERNAME,
                pass: process.env.MAIL_PASSWORD,
            },
        });

        const capitalizedName =
            (process.env.DATABASE_NAME || "System").slice(0, 1).toUpperCase() +
            (process.env.DATABASE_NAME || "System").slice(1);

        const order = toPlain(orderDoc);
        const user = toPlain(userDoc);

        let itemData = []
        for (const item of order.items) {
            const product = await ProductShopping.findById(item.productId);
            for (const variant of product.variants) {
                if (variant.sku === item.variant.sku) {
                    itemData.push({
                        "name": product.title.en,
                        "sku": item.variant.sku,
                        "quantity": item.quantity,
                        "originalPrice": item.originalPrice,
                        "totalPrice": item.totalPrice
                    })
                }
            }
        }

        const BuyerName = get(user, "user")?.name || "ไม่ระบุ";
        const BuyerEmail = get(user, "user")?.email || "ไม่ระบุ";
        const OrderTime = formatDateThai(
            order?.paidAt || order?.updatedAt || Date.now()
        );
        const originalPrice = formatBaht(order?.originalPrice);
        const payBrand = order?.paymentMetadata?.brand || "-";
        const payLast4 = order?.paymentMetadata?.last4 || "";
        const receiptUrl = order?.paymentMetadata?.receiptUrl || "";

        const itemHtml = itemData.map(item => {
            return `
              <div style="margin-bottom:6px;">
                🛒 <b>${item.name}</b> (SKU: ${item.sku})<br/>
                จำนวน: ${item.quantity} ชิ้น<br/>
                ราคาต่อชิ้น: ${formatBaht(item.originalPrice)}<br/>
                ราคารวม: ${formatBaht(item.totalPrice)}
              </div>
            `;
        }).join("");

        const html = `
        <!doctype html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          <title>New Order</title>
          <style>
            @media (max-width: 620px) {
              .card { padding: 16px !important; }
              .h2 { font-size: 20px !important; }
              .table th, .table td { padding: 10px !important; }
            }
          </style>
        </head>
        <body style="margin:0; padding:24px; background:#0f1115; font-family: -apple-system,BlinkMacSystemFont,Segoe UI,Roboto,Helvetica,Arial,sans-serif; color:#e6e7eb;">
          <div style="max-width:640px; margin:0 auto;">
            <div style="text-align:center; margin-bottom:16px;">
              <div style="display:inline-block; padding:6px 12px; border-radius:999px; background:linear-gradient(90deg,#2a2f3a,#1d2230); color:#c9d1d9; font-size:12px; letter-spacing:.3px; border:1px solid #2b3242;">
                Nightlife Notification
              </div>
            </div>
            <div  style="margin:0 0 12px; color:#ffffff !important; font-size:22px; letter-spacing:.2px;">
                📣 มีคำสั่งซื้อใหม่เข้ามา
            </div>
            <div class="card" style="background:linear-gradient(180deg,#171a21,#141821); border:1px solid #2b3242; box-shadow:0 20px 45px rgba(0,0,0,.45), inset 0 1px 0 rgba(255,255,255,.04); border-radius:16px; padding:24px;">
              
              <div style="margin:0 0 18px; color:#94a3b8; font-size:14px;">
                ระบบ <b style="color:#e6e7eb">${capitalizedName}</b> แจ้งรายละเอียดการจองดังนี้
              </div>
        
              <!-- ลบแถว summary 3 คอลัมน์ออก -->
        
              <table class="table" width="100%" cellpadding="0" cellspacing="0" role="presentation"
                     style="border-collapse:separate; width:100%; overflow:hidden; border-radius:12px; border:1px solid #273148;">
                <tbody>
                  <tr style="background:#0f131c;">
                    <th align="left" style="padding:12px 14px; color:#a3b1c6; font-weight:600; width:34%;">ชื่อผู้ซื้อ</th>
                    <td style="padding:12px 14px; color:#e6e7eb;">${BuyerName}</td>
                  </tr>
                  <tr style="background:#0b1018;">
                    <th align="left" style="padding:12px 14px; color:#a3b1c6; font-weight:600;">อีเมลผู้ซื้อ</th>
                    <td style="padding:12px 14px;"><a href="mailto:${BuyerEmail}" style="color:#8ab4ff;">${BuyerEmail}</a></td>
                  </tr>
                  <tr style="background:#0f131c;">
                    <th align="left" style="padding:12px 14px; color:#a3b1c6; font-weight:600;">สินค้า</th>
                    <td style="padding:12px 14px; color:#e6e7eb;">${itemHtml}</td>
                  </tr>
                  <tr style="background:#0b1018;">
                    <th align="left" style="padding:12px 14px; color:#a3b1c6; font-weight:600;">วันเวลาซื้อ</th>
                    <td style="padding:12px 14px; color:#e6e7eb;">${OrderTime}</td>
                  </tr>
                  <tr style="background:#0b1018;">
                    <th align="left" style="padding:12px 14px; color:#a3b1c6; font-weight:600;">ราคาเต็ม</th>
                    <td style="padding:12px 14px; color:#e6e7eb;">${originalPrice}</td>
                  </tr>
                  <tr style="background:#0b1018;">
                    <th align="left" style="padding:12px 14px; color:#a3b1c6; font-weight:600;">วิธีชำระ</th>
                    <td style="padding:12px 14px; color:#e6e7eb;">${payBrand}${payLast4 ? " •••• " + payLast4 : ""
            }${receiptUrl
                ? ` — <a href="${receiptUrl}" style="color:#8ab4ff;">ใบเสร็จ</a>`
                : ""
            }</td>
                  </tr>
                </tbody>
              </table>
        
              <p style="margin:16px 4px 0; color:#9aa9be; font-size:13px;">
                ดูรายละเอียดเพิ่มเติมในระบบหลังบ้านได้เลยครับ
              </p>
              <div style="margin-top:18px; color:#cbd5e1; font-weight:600;">
                ทีมงาน ${capitalizedName}
              </div>
            </div>
            <div style="text-align:center; margin-top:12px; color:#6b7280; font-size:12px;">
              This is an automated notification from ${capitalizedName}.
            </div>
          </div>
        </body>
        </html>`;

        const subject = `📩 New Order — ${BuyerName} — ${OrderTime}`;

        await transporter.sendMail({
            from: `${capitalizedName} Notifications <${process.env.MAIL_USERNAME}>`,
            to: recipients,
            subject,
            html,
        });

        // console.log(`order => ${order}`)
        // console.log(`itemData => ${JSON.stringify(itemData)}`)
        console.log("✅ ส่งอีเมลแจ้งจองสำเร็จไปยัง:", recipients.join(", "));
    }
    catch (error) {
        console.error("❌ ส่งอีเมลแจ้งจองล้มเหลว:", err.message);
    }
}