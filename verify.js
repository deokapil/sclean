var csvParser = require("csv-parse");
var fpcalc = require("fpcalc");
var fs = require("fs");
const fileName = "data/all-songs.csv";
var https = require("https");

// const key = "ylj1qLxDeY";
const key = "euABKVAesT";

// fpcalc("./Amos.mp3", function (err, result) {
//   if (err) throw err;
//   console.log(result.duration, result.fingerprint);
//   fetch(
//     `https://api.acoustid.org/v2/lookup?client=${key}&fingerprint=${result.fingerprint}`
//   ).then((response) => {
//     if (response.status === 200) {
//       console.log(response.json());
//     } else {
//       throw new Error("Something went wrong on API server!");
//     }
//   });
// });

const getFingerPrint = (filePath) => {
  return new Promise((resolve, reject) => {
    fpcalc(filePath, function (err, result) {
      if (err) reject(err);
      resolve({ fingerprint: result.fingerprint, duration: result.duration });
    });
  });
};

const get_all = async () => {
  const filePath = "./Amos.mp3";
  const { fingerprint, duration } = await getFingerPrint(filePath);
  let json = null;
  const url = `https://api.acoustid.org/v2/lookup?client=${key}&duration=${duration}&fingerprint=${fingerprint}`;
  console.log(url);
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Response status: ${response.status}`);
    }
    json = await response.json();
  } catch (error) {
    console.error(error.message);
  }
  console.log(json);
};

// Parse csv file for file path

const parseCSV = (filePath) => {
  const records = [];
  // Initialize the parser
  return new Promise((resolve, reject) => {
    fs.createReadStream(filePath).pipe(
      csvParser
        .parse({ from_line: 2, delimiter: ",", to_line: 5 })
        .on("data", (row) => {
          records.push(row);
        })
        .on("end", () => {
          resolve(records);
        })
        .on("error", (err) => {
          console.log(err);
        })
    );
  });
  return records;
};

function getRemoteFile(file, url) {
  let localFile = fs.createWriteStream(file);
  const client = https;
  const request = client.get(url, function (response) {
    var len = parseInt(response.headers["content-length"], 10);
    var cur = 0;
    var total = len / 1048576; //1048576 - bytes in 1 Megabyte

    response.on("data", function (chunk) {
      cur += chunk.length;
      showProgress(file, cur, len, total);
    });

    response.on("end", function () {
      console.log("Download complete");
    });

    response.pipe(localFile);
  });
}

// Store response in database
const main = async () => {
  const records = await parseCSV(fileName);
  for (i = 0; i < records.length; i++) {
    let rec = records[i];
    let songName = rec[7].split("/").pop();
    console.log(rec[7]);
  }
};

main();
