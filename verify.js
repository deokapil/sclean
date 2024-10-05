import { parse } from "csv-parse";

import { createRequire } from "module";
const require = createRequire(import.meta.url);

const fpcalc = require("fpcalc");

const path = require("path");
const fs = require("fs");
const winston = require("winston");

const axios = require("axios");
const lowdb = require("lowdb");
const lnode = require("lowdb/node");

const key = "euABKVAesT";

// import { JSONFileSync } from "lowdb/node";

const db = new lowdb.LowSync(new lnode.JSONFileSync("file01.json"), {
  posts: [],
});
db.read();

const addToDB = async (msgList) => {
  // check if record with messageId exists
  msgList.forEach(async (data) => {
    await db.data.posts.push(data);
  });

  db.write();
};

const fileName = "data/all-songs.csv";
// Define the log file path
const logFilePath = path.join(__dirname, "app.log");

// Create a winston logger instance with file transport
const logger = winston.createLogger({
  level: "info", // Log level (info, error, warn, etc.)
  format: winston.format.combine(
    winston.format.timestamp(), // Add a timestamp to each log
    winston.format.printf(({ timestamp, level, message }) => {
      return `${timestamp} [${level.toUpperCase()}]: ${message}`;
    })
  ),
  transports: [
    new winston.transports.File({ filename: logFilePath }), // Log to a file
  ],
});

// const key = "ylj1qLxDeY";

const getFingerPrint = (filePath) => {
  return new Promise((resolve, reject) => {
    fpcalc(filePath, function (err, result) {
      if (err) reject(err);
      resolve({ fingerprint: result.fingerprint, duration: result.duration });
    });
  });
};

const get_all = async (filePath) => {
  const { fingerprint, duration } = await getFingerPrint(filePath);
  let json = null;
  const url = `https://api.acoustid.org/v2/lookup?client=${key}&duration=${duration}&fingerprint=${fingerprint}`;
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Response status: ${response.status}`);
    }
    json = await response.json();
  } catch (error) {
    logger.error(`Error in fetching ${rec[0]}: ${err}`);
  }
  return json;
};

// Parse csv file for file path

const parseCSV = (filePath) => {
  const records = [];
  // Initialize the parser
  return new Promise((resolve, reject) => {
    const parser = parse({
      delimiter: ",",
    });
    fs.createReadStream(filePath).pipe(
      parser({ from_line: 2, delimiter: ",", to_line: 3 })
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
};

async function getRemoteFile(file, url) {
  let writer = fs.createWriteStream(`./tmp/${file}`);

  const response = await axios({
    url,
    method: "GET",
    responseType: "stream",
  });

  response.data.pipe(writer);

  return new Promise((resolve, reject) => {
    writer.on("finish", resolve);
    writer.on("error", reject);
  });
}

// Store response in database
const main = async () => {
  const records = await parseCSV(fileName);
  for (i = 0; i < records.length; i++) {
    let rec = records[i];
    let songName = rec[7].split("/").pop();
    // Download the mp3 file from rec[15] and store it in songName
    try {
      await getRemoteFile(songName, rec[15]);
      logger.info(`Success downloading ${rec[0]}: ${err}`);
    } catch (err) {
      logger.error(`Error downloading ${rec[0]}: ${err}`);
    }
    try {
      const messages = await get_all(songName);
      if (messages) {
        addToDB(messages);
      }
      logger.error(`Error no message recieved ${rec[0]}: ${err}`);
    } catch (err) {
      logger.error(`Error in fpcalc ${rec[0]}: ${err}`);
    }
  }
};

main();
