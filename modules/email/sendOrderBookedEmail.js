const nodemailer = require("nodemailer");

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

module.exports = async function sendOrderBookedEmail(
  orderDoc,
  userDoc,
  activityDoc
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
    const activity = toPlain(activityDoc);

    const activityName =
      get(activity, "nameTh") ||
      get(activity, "nameEn") ||
      get(activity, "name") ||
      get(get(activity, "location"), "nameTh") ||
      get(get(activity, "location"), "nameEn") ||
      `กิจกรรม #${get(activity, "_id") || "ไม่ระบุ"}`;

    const bookerName = get(user, "user")?.name || "ไม่ระบุ";
    const bookerEmail = get(user, "user")?.email || "ไม่ระบุ";
    const bookingTime = formatDateThai(
      order?.paidAt || order?.updatedAt || Date.now()
    );
    const eventTime = formatDateThai(order?.bookingDate);

    const adults = order?.adults ?? 0;
    const children = order?.children ?? 0;
    const paidAmount = formatBaht(order?.paidAmount);
    const originalPrice = formatBaht(order?.originalPrice);
    const discountAmount = order?.discountAmount
      ? formatBaht(order.discountAmount)
      : null;
    const discountCodeUsed = order?.discountCodeUsed || null;

    const payBrand = order?.paymentMetadata?.brand || "-";
    const payLast4 = order?.paymentMetadata?.last4 || "";
    const receiptUrl = order?.paymentMetadata?.receiptUrl || "";

    const html = `
<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>New Booking</title>
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
        📣 มีคำสั่งจองใหม่เข้ามา
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
            <th align="left" style="padding:12px 14px; color:#a3b1c6; font-weight:600; width:34%;">ชื่อผู้จอง</th>
            <td style="padding:12px 14px; color:#e6e7eb;">${bookerName}</td>
          </tr>
          <tr style="background:#0b1018;">
            <th align="left" style="padding:12px 14px; color:#a3b1c6; font-weight:600;">อีเมลผู้จอง</th>
            <td style="padding:12px 14px;"><a href="mailto:${bookerEmail}" style="color:#8ab4ff;">${bookerEmail}</a></td>
          </tr>
          <tr style="background:#0f131c;">
            <th align="left" style="padding:12px 14px; color:#a3b1c6; font-weight:600;">กิจกรรม</th>
            <td style="padding:12px 14px; color:#e6e7eb;">${activityName}</td>
          </tr>
          <tr style="background:#0b1018;">
            <th align="left" style="padding:12px 14px; color:#a3b1c6; font-weight:600;">วันเวลาจอง</th>
            <td style="padding:12px 14px; color:#e6e7eb;">${bookingTime}</td>
          </tr>
          <tr style="background:#0f131c;">
            <th align="left" style="padding:12px 14px; color:#a3b1c6; font-weight:600;">วันเวลากิจกรรม</th>
            <td style="padding:12px 14px; color:#e6e7eb;">${eventTime}</td>
          </tr>
          <tr style="background:#0b1018;">
            <th align="left" style="padding:12px 14px; color:#a3b1c6; font-weight:600;">จำนวนผู้ใหญ่</th>
            <td style="padding:12px 14px; color:#e6e7eb;">${adults}</td>
          </tr>
          <tr style="background:#0f131c;">
            <th align="left" style="padding:12px 14px; color:#a3b1c6; font-weight:600;">จำนวนเด็ก</th>
            <td style="padding:12px 14px; color:#e6e7eb;">${children}</td>
          </tr>
          <tr style="background:#0b1018;">
            <th align="left" style="padding:12px 14px; color:#a3b1c6; font-weight:600;">ราคาเต็ม</th>
            <td style="padding:12px 14px; color:#e6e7eb;">${originalPrice}</td>
          </tr>
          ${
            discountAmount
              ? `<tr style="background:#0f131c;">
                   <th align="left" style="padding:12px 14px; color:#a3b1c6; font-weight:600;">ส่วนลด</th>
                   <td style="padding:12px 14px; color:#e6e7eb;">${discountAmount}${
                  discountCodeUsed
                    ? ` <span style="opacity:.8">(โค้ด: ${discountCodeUsed})</span>`
                    : ""
                }</td>
                 </tr>`
              : ""
          }
          <tr style="background:#101620;">
            <th align="left" style="padding:12px 14px; color:#a3b1c6; font-weight:700;">ยอดชำระ</th>
            <td style="padding:12px 14px; color:#ffffff; font-weight:700;">${paidAmount}</td>
          </tr>
          <tr style="background:#0b1018;">
            <th align="left" style="padding:12px 14px; color:#a3b1c6; font-weight:600;">วิธีชำระ</th>
            <td style="padding:12px 14px; color:#e6e7eb;">${payBrand}${
      payLast4 ? " •••• " + payLast4 : ""
    }${
      receiptUrl
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

    const subject = `📩 New Booking — ${activityName} — ${bookingTime}`;
    await transporter.sendMail({
      from: `${capitalizedName} Notifications <${process.env.MAIL_USERNAME}>`,
      to: recipients,
      subject,
      html,
    });

    console.log("✅ ส่งอีเมลแจ้งจองสำเร็จไปยัง:", recipients.join(", "));
  } catch (err) {
    console.error("❌ ส่งอีเมลแจ้งจองล้มเหลว:", err.message);
  }
};
