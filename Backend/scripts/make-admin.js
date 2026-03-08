require("dotenv").config({ path: require("path").join(__dirname, "../.env") });
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const User = require("../models/User"); // adjust path if needed

async function main() {
  await mongoose.connect(process.env.MONGO_URI);

  const existing = await User.findOne({ email: "admin@craftsos.com" });
  if (existing) {
    await User.updateOne({ _id: existing._id }, { role: "admin" });
    console.log("Updated existing user to admin:", existing.email);
  } else {
    const password = await bcrypt.hash("Admin1234!", 10);
    await User.create({
      firstName: "Admin",
      lastName: "User",
      username: "admin",
      handle: "admin",
      email: "admin@craftsos.com",
      password,
      role: "admin",
      communityRole: "both",
    });
    console.log("Created admin user: admin@craftsos.com / Admin1234!");
  }

  await mongoose.disconnect();
}

main().catch(console.error);
// backend/scripts/make-admin.js
