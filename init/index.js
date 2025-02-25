const mongoose = require("mongoose");
const MONGO_URL = "mongodb://127.0.0.1:27017/EwastePlatform";
const initData = require("../init/fact.js");
const Fact = require("../models/facts.js");


async function main() {
  await mongoose.connect(MONGO_URL);
}

main()
  .then(() => {
    console.log("connected to DB");
  })
  .catch((err) => {
    console.log(err);
  });

const initDb = async () => {
    await Fact.deleteMany({});
    await Fact.insertMany(initData.data);
};

initDb();
