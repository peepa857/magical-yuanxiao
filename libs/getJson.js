const moment = require("moment");
const fs = require("fs");

// promisify fs.readFile()
fs.readFileAsync = function (filename) {
  return new Promise(function (resolve, reject) {
    try {
      fs.readFile(filename, function (err, jsonData) {
        if (err) reject(err);
        else resolve(JSON.parse(jsonData));
      });
    } catch (err) {
      reject(err);
    }
  });
};

// utility function
function getJsonAsync(i) {
  return fs.readFileAsync(
    "./output/" +
    moment().subtract(i, "days").format("YYYYMMDD") +
    "_sprint_data.json"
  );
}

module.exports = getJsonAsync;
