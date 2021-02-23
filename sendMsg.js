// test file
// Run "node sendMsg.js" to test access slack token
// If send message to channel is successful, the token is OK
const dotenv = require("dotenv");
const axios = require("axios");
const { MSG_URL } = require("./libs/consts");

dotenv.config("./env");
const slackToken = process.env["SLACK_TOKEN"];
const slackChannel = process.env["SLACK_CHANNEL"];

async function run() {
  const res = await axios.post(
    MSG_URL,
    {
      channel: slackChannel, // *send to target channel*
      text: "Hello, I am magical yuanxiao!", // message content
    },
    {
      headers: {
        authorization: `Bearer ${slackToken}`,
      },
    }
  );
  console.log("Done", res.data);
}

run().catch((err) => console.log(err));
