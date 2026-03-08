require("dotenv").config({ path: require("path").join(__dirname, "../.env") });
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

mongoose.connect(process.env.MONGO_URI).then(async () => {
  const hash = await bcrypt.hash("Admin1234!", 12);
  const r = await mongoose.connection
    .collection("users")
    .updateOne({ email: "admin@craftsos.com" }, { $set: { password: hash } });
  console.log("modified:", r.modifiedCount);
  mongoose.disconnect();
});
// backend/scripts/fix-password.js
