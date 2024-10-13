import { parse } from "csv-parse";
import path from "path";
import { fileURLToPath } from "url";
import { LowSync } from "lowdb";
import { JSONFileSync } from "lowdb/node";

import { createRequire } from "module";
const require = createRequire(import.meta.url);

const fpcalc = require("fpcalc");

const fs = require("fs");
const winston = require("winston");

const axios = require("axios");

const key = "euABKVAesT";

const __filename = fileURLToPath(import.meta.url); // get the resolved path to the file
const __dirname = path.dirname(__filename); // get the name of the directory

const db = new LowSync(new JSONFileSync("file01.json"), {
  posts: [],
});
db.read();

function checkIfIdExists(id) {
  return db.data.posts.find((post) => post.id === id);
}

const addToDB = async (msgList, songId) => {
  // check if record with messageId exists
  await db.data.posts.push({ id: songId, msgList: msgList.results });
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
  try {
    const { fingerprint, duration } = await getFingerPrint(filePath);
  } catch (err) {
    logger.error(`Error in fetching ${rec[0]}: ${err}`);
    return null;
  }
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

const parseCSV = async (filePath) => {
  const records = [];
  // Initialize the parser

  const parser = fs.createReadStream(`${__dirname}/${filePath}`).pipe(
    parse(
      { from_line: 2, delimiter: ",", to_line: 20, delimiter: "," }
      // CSV options if any
    )
  );

  for await (const record of parser) {
    // Work with each record
    records.push(record);
  }
  return records;
};

async function getRemoteFile(file, url) {
  let writer = fs.createWriteStream(file);

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

// Delete the Downloaded file

const deleteFile = (filePath) => {
  fs.unlink(`./tmp/${filePath}`, (err) => {
    if (err) {
      logger.error(err);
    }
  });
};

// Store response in database
const main = async () => {
  const records = await parseCSV(fileName);
  for (let i = 0; i < records.length; i++) {
    let rec = records[i];
    if (checkIfIdExists(rec[0])) {
      continue;
    }
    let songName = rec[7].split("/").pop();
    const filePath = `./tmp/${songName}`;
    // Download the mp3 file from rec[15] and store it in songName
    try {
      await getRemoteFile(filePath, rec[15]);
      logger.info(`Success downloading ${rec[0]}: ${err}`);
    } catch (err) {
      logger.error(`Error downloading ${rec[0]}: ${err}`);
    }
    try {
      const messages = await get_all(filePath);
      if (messages) {
        if (messages.status === "ok") {
          await addToDB(messages, rec[0]);
        }
      }
      logger.error(`Error no message recieved ${rec[0]}: ${err}`);
    } catch (err) {
      logger.error(`Error in fpcalc ${rec[0]}: ${err}`);
    }
    // Delete the downloaded file
    deleteFile(songName);
  }
};

// check if id exists in lowdb

main();
