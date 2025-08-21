// modules/email/sendSubscriptionExpiryEmail.js
const { sendEmail } = require('./email');

/**
 * ส่ง email แจ้งเตือน subscription ใกล้หมดอายุ
 * @param {Object} subscription - subscription object
 * @param {number} daysRemaining - จำนวนวันที่เหลือ
 */
const sendSubscriptionExpiryEmail = async (subscription, daysRemaining) => {
  try {
    const user = subscription.userId;
    const subscriptionType = subscription.subscriptionType;
    const endDate = new Date(subscription.endDate).toLocaleDateString('th-TH');
    
    // เลือก subject และ content ตามจำนวนวันที่เหลือ
    let subject, htmlContent, textContent;
    
    if (daysRemaining <= 1) {
      // แจ้งเตือน 1 วันก่อนหมดอายุ (urgent)
      subject = `🚨 ${subscriptionType.toUpperCase()} subscription หมดอายุพรุ่งนี้!`;
      
      htmlContent = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 20px; text-align: center;">
            <h1 style="color: white; margin: 0;">⚠️ Subscription Expiring Soon!</h1>
          </div>
          
          <div style="padding: 30px; background: #f8f9fa;">
            <h2 style="color: #dc3545;">สวัสดี ${user.user.name}!</h2>
            
            <div style="background: #fff3cd; border: 1px solid #ffeaa7; padding: 15px; border-radius: 8px; margin: 20px 0;">
              <p style="margin: 0; color: #856404;">
                <strong>🔔 ${subscriptionType.toUpperCase()} subscription ของคุณจะหมดอายุ<span style="color: #dc3545;">พรุ่งนี้</span>!</strong>
              </p>
            </div>
            
            <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
              <h3 style="margin-top: 0; color: #495057;">📋 รายละเอียด Subscription:</h3>
              <ul style="list-style: none; padding: 0;">
                <li style="margin: 10px 0;"><strong>ระดับ:</strong> ${subscriptionType.toUpperCase()}</li>
                <li style="margin: 10px 0;"><strong>วันหมดอายุ:</strong> <span style="color: #dc3545;">${endDate}</span></li>
                <li style="margin: 10px 0;"><strong>วันที่เหลือ:</strong> <span style="color: #dc3545; font-size: 18px;">${daysRemaining} วัน</span></li>
              </ul>
            </div>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${process.env.FRONTEND_URL}/subscription" 
                 style="background: #28a745; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block;">
                🔄 ต่ออายุ Subscription
              </a>
            </div>
            
            <div style="background: #e9ecef; padding: 15px; border-radius: 8px; margin: 20px 0;">
              <h4 style="margin-top: 0;">💎 สิทธิประโยชน์ที่จะสูญหาย:</h4>
              ${subscriptionType === 'premium' ? `
                <ul>
                  <li>✨ Premium badge</li>
                  <li>🎯 Priority customer support</li>
                  <li>🎪 Exclusive events access</li>
                  <li>🎨 Advanced profile customization</li>
                </ul>
              ` : `
                <ul>
                  <li>💎 Platinum badge</li>
                  <li>🏆 VIP customer support</li>
                  <li>🚀 Early access to new features</li>
                  <li>👑 Exclusive platinum events</li>
                  <li>🤝 Personal account manager</li>
                </ul>
              `}
            </div>
            
            <p style="color: #6c757d; font-size: 14px; margin-top: 30px;">
              หากคุณไม่ต่ออายุ subscription ระดับของคุณจะกลับเป็น Regular อัตโนมัติ
            </p>
          </div>
          
          <div style="background: #343a40; color: white; padding: 20px; text-align: center;">
            <p style="margin: 0;">© 2024 Healworld | <a href="${process.env.FRONTEND_URL}" style="color: #ffc107;">healworld.com</a></p>
          </div>
        </div>
      `;
      
    } else {
      // แจ้งเตือน 7 วันก่อนหมดอายุ (reminder)
      subject = `⏰ ${subscriptionType.toUpperCase()} subscription หมดอายุในอีก ${daysRemaining} วัน`;
      
      htmlContent = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 20px; text-align: center;">
            <h1 style="color: white; margin: 0;">⏰ Subscription Reminder</h1>
          </div>
          
          <div style="padding: 30px; background: #f8f9fa;">
            <h2 style="color: #495057;">สวัสดี ${user.user.name}!</h2>
            
            <div style="background: #d1ecf1; border: 1px solid #bee5eb; padding: 15px; border-radius: 8px; margin: 20px 0;">
              <p style="margin: 0; color: #0c5460;">
                <strong>🔔 ${subscriptionType.toUpperCase()} subscription ของคุณจะหมดอายุในอีก ${daysRemaining} วัน</strong>
              </p>
            </div>
            
            <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
              <h3 style="margin-top: 0; color: #495057;">📋 รายละเอียด Subscription:</h3>
              <ul style="list-style: none; padding: 0;">
                <li style="margin: 10px 0;"><strong>ระดับ:</strong> ${subscriptionType.toUpperCase()}</li>
                <li style="margin: 10px 0;"><strong>วันหมดอายุ:</strong> ${endDate}</li>
                <li style="margin: 10px 0;"><strong>วันที่เหลือ:</strong> <span style="color: #ffc107; font-size: 18px;">${daysRemaining} วัน</span></li>
              </ul>
            </div>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${process.env.FRONTEND_URL}/subscription" 
                 style="background: #007bff; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block;">
                🔄 ต่ออายุ Subscription
              </a>
            </div>
            
            <p style="color: #6c757d; font-size: 14px;">
              ต่ออายุก่อนหมดเวลาเพื่อไม่ให้สูญเสียสิทธิประโยชน์ที่มีค่า!
            </p>
          </div>
          
          <div style="background: #343a40; color: white; padding: 20px; text-align: center;">
            <p style="margin: 0;">© 2024 Healworld | <a href="${process.env.FRONTEND_URL}" style="color: #ffc107;">healworld.com</a></p>
          </div>
        </div>
      `;
    }
    
    // Text version (fallback)
    textContent = `
สวัสดี ${user.user.name}!

${subscriptionType.toUpperCase()} subscription ของคุณจะหมดอายุในอีก ${daysRemaining} วัน

รายละเอียด:
- ระดับ: ${subscriptionType.toUpperCase()}
- วันหมดอายุ: ${endDate}
- วันที่เหลือ: ${daysRemaining} วัน

ต่ออายุ subscription ได้ที่: ${process.env.FRONTEND_URL}/subscription

© 2024 Healworld
    `.trim();
    
    // ส่ง email
    await sendEmail(user.user.email, subject, textContent, htmlContent);
    
    console.log(`✅ Subscription expiry email sent to ${user.user.email} (${daysRemaining} days remaining)`);
    
    return true;
  } catch (error) {
    console.error('❌ Error sending subscription expiry email:', error);
    return false;
  }
};

module.exports = {
  sendSubscriptionExpiryEmail
};
