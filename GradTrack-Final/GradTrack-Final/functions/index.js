const functions = require("firebase-functions/v1"); // تعديل مهم لضمان التوافق مع المحاكي
const admin = require("firebase-admin");
const nodemailer = require("nodemailer");

// تهيئة التطبيق
admin.initializeApp();

// إعداد حساب Gmail للإرسال
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: "gradtrack.project@gmail.com", 
    pass: "llctfhojonziwdyy"           
  }
});

/**
 * Trigger: يعمل عند إنشاء مستخدم جديد
 */
exports.sendWelcomeEmail = functions.auth.user().onCreate((user) => {
  const email = user.email;

  const mailOptions = {
    from: '"GradTrack System" <gradtrack.project@gmail.com>', // يفضل أن يكون نفس بريد الإرسال
    to: email,
    subject: "Welcome to GradTrack - تأكيد الحساب",
    text: `أهلاً بك في نظام GradTrack. تم تسجيلك بنجاح ببريد: ${email}.`
  };

  return transporter.sendMail(mailOptions)
    .then(() => {
      console.log("✅ Success: Welcome email sent to:", email);
      return null;
    })
    .catch((error) => {
      console.error("❌ Error: Could not send email:", error);
      return null;
    });
});