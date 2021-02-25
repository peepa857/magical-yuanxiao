// node module
const JiraApi = require("jira-client");
const fs = require("fs");
const request = require("request");
const path = require("path");
const moment = require("moment");
const { ChartJSNodeCanvas } = require("chartjs-node-canvas");
const dotenv = require("dotenv");
// project module
const { UPLOAD_URL } = require("./libs/consts");
const getJsonAsync = require("./libs/getJson");

// load env setting variable
dotenv.config("./env");
const slackToken = process.env["SLACK_TOKEN"];
const slackChannel = process.env["SLACK_CHANNEL"];
const rapidViewId = process.env["RAPID_VIEW_ID"];
const sprintId = process.env["SPRINT_ID"];
const jiraHost = process.env["JIRA_HOST"];
const jiraUsername = process.env["JIRA_USERNAME"];
const jiraPassword = process.env["JIRA_PASSWORD"];

// jira API options
const jira = new JiraApi({
  protocol: "https",
  host: jiraHost,
  username: jiraUsername,
  password: jiraPassword,
  apiVersion: "3",
  strictSSL: true,
});

// today's date
const YYYYMMDD = moment().format("YYYYMMDD");

async function sendChart() {
  // step1: get sprint info to generate json from jira
  let sprint = {};
  await jira
    .getSprintIssues(rapidViewId, sprintId)
    .then(function (issues) {
      sprint["id"] = issues.sprint.id; // スプリントID
      sprint["name"] = issues.sprint.name; // スプリント名
      sprint["goal"] = issues.sprint.goal ? issues.sprint.goal : 0; // 目標点数
      sprint["startDate"] = moment(issues.sprint.isoStartDate).format(
        "YYYYMMDD"
      ); // 開始日
      sprint["endDate"] = moment(issues.sprint.isoEndDate).format("YYYYMMDD"); // 終了日
      sprint["issuesPointSum"] = issues.contents.completedIssuesEstimateSum
        .value
        ? issues.contents.completedIssuesEstimateSum.value
        : 0 + issues.contents.issuesNotCompletedEstimateSum.value
          ? issues.contents.issuesNotCompletedEstimateSum.value
          : 0; // ストーリー点数合計
      sprint["notCompletedIssuesPointSum"] = issues.contents
        .issuesNotCompletedEstimateSum.value
        ? issues.contents.issuesNotCompletedEstimateSum.value
        : 0; // 未完了ストーリー点数合計(include: todo, doing, review...)
    })
    .catch(function (err) {
      console.error(err);
    });

  // json data to be written
  let jsonData = {
    code: 0,
    data: sprint,
    updateDate: moment().format("YYYY/MM/DD HH:mm:ss"),
    msg: "success",
  };
  // format json
  let text = JSON.stringify(jsonData);
  // params: directory and file name
  let file = path.join("./output/", YYYYMMDD + "_sprint_data.json");
  // write into json
  await fs.writeFile(file, text, function (err) {
    if (err) {
      console.log(err);
    } else {
      console.log("File was successfully created: " + file);
    }
  });

  // step2: get data for line chart
  var startAndEndDateDiff = moment(sprint.endDate).diff(
    moment(sprint.startDate),
    "days"
  );
  // X axis labels for line chart
  var xLabels = [];
  for (let i = 0; i <= startAndEndDateDiff; i++) {
    xLabels[i] = moment(sprint.startDate).add(i, "days").format("MM/DD");
  }

  // Y axis values for line chart
  var yValues = [];
  // from 0 to date difference(from today to startDate)
  var dateDifferenceArray = [];
  for (let i = 0; i <= moment().diff(moment(sprint.startDate), "days"); i++) {
    dateDifferenceArray.push(i);
  }
  var jsonArray = dateDifferenceArray.reverse().map(getJsonAsync);
  await Promise.all(jsonArray)
    .then(function (jsonData) {
      // 本スプリントの日別残ポイントデータを埋め込む
      yValues = jsonData.map((s) => s.data.notCompletedIssuesPointSum);
    })
    .catch(function (err) {
      console.error(err);
    });

  // guideline Y axis values
  var guidelineValues = [];
  for (let i = 0; i <= startAndEndDateDiff; i++) {
    guidelineValues.push(
      sprint.goal - Math.floor((sprint.goal * i) / startAndEndDateDiff)
    );
  }

  // step3: create burn down chart image
  const height = 400;
  const width = 700;
  const chartJSNodeCanvas = new ChartJSNodeCanvas({ width, height });
  (async () => {
    const configuration = {
      type: "line",
      data: {
        labels: xLabels,
        datasets: [
          {
            label: "Story Points remaining",
            borderColor: "rgba(255, 100, 100, 1)",
            data: yValues,
            fill: false,
            tension: 0, // straight line
          },
          {
            label: "Guideline",
            borderColor: "rgba(122, 122, 122, 1)",
            borderDash: [10, 3], // dotted line
            data: guidelineValues,
            fill: false,
            borderWidth: 1,
            tension: 0,
          },
        ],
      },
      options: {
        scales: {
          yAxes: [
            {
              ticks: {
                beginAtZero: true, // set Y min value to 0
              },
              scaleLabel: {
                fontSize: 16,
                fontStyle: "bold",
              },
            },
          ],
          xAxes: [
            {
              scaleLabel: {
                fontSize: 16,
                fontStyle: "bold",
              },
            },
          ],
        },
        elements: {
          point: {
            radius: 0, // do not show points
          },
        },
        title: {
          display: true,
          fontSize: 16,
          text:
            sprint.name +
            "(" +
            moment(sprint.startDate).format("MM/DD") +
            "~" +
            moment(sprint.endDate).format("MM/DD") +
            ")", // chart title
        },
      },
    };
    const dataUrl = await chartJSNodeCanvas.renderToDataURL(configuration);
    const base64Data = dataUrl.replace(/^data:image\/png;base64,/, "");
    await fs.writeFile(
      "./output/" + YYYYMMDD + "_burn_down_chart.png",
      base64Data,
      "base64",
      function (err) {
        if (err) {
          console.log(err);
        }
      }
    );
  })();

  // step4: upload created chart to slack
  function uploadFile() {
    request.post(
      {
        url: UPLOAD_URL,
        formData: {
          file: fs.createReadStream(
            "./output/" + YYYYMMDD + "_burn_down_chart.png"
          ),
          token: slackToken,
          filetype: "png",
          filename: YYYYMMDD + "_burn_down_chart.png",
          channels: slackChannel, // send to XXX channel
          title: YYYYMMDD + "_burn_down_chart.png", // show this name in slack
        },
      },
      function (error, response, body) {
        if (error) {
          console.log(error);
        } else {
          console.log("Send burn down chart to slack at " + moment().format("YYYY/MM/DD HH:mm:ss"));
        }
      }
    );
  }
  console.log("----------------------------");
  console.log("Waiting for the new chart");
  console.log("----------------------------");
  setTimeout(uploadFile, 3000);
}
sendChart().catch((err) => console.log(err));

module.exports = sendChart;
