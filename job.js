const sendChart = require("./app");
const schedule = require("node-schedule");

// daily job at working day 18:00
schedule.scheduleJob("00 18 * * 1-5", sendChart);
