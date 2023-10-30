const bcrypt = require("bcryptjs");
const User = require("../models/UserModel");
const mongoose = require("mongoose");
const { isArrayBufferView } = require("util/types");

const { MONGO_URL } = process.env;

(async () => {
  let data = await bcrypt.hash("Bharat@123", 12);

  console.log(data);

  mongoose.connect(MONGO_URL, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  });

  let email = "Cary.Rodriguez36@yahoo.com";
  try {
    const user = await User.findOne({ email });

    console.log(user);

    let auth = await bcrypt.compare("Bharat@123", user.password);

    console.log(user.password);

    console.log(auth);

    auth = await bcrypt.compare(
      "Bharat@123",
      "$2a$12$GCb8vEODWu5kv/Or1c7.L.oJoCs6uNvtJMwo9FEpYE37vEhP7L8zC"
    );

    console.log(auth);
  } catch (err) {
    console.log(err);
  }

  mongoose.disconnect();
})();
