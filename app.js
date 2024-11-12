"use strict";

require("dotenv").config();

const shortid = require("shortid");

const {
    CHAT_ROOM_NAME: chatRoomName,
    CHAT_ROOM_SECRET: chatRoomSecret,
    CHAT_ROOM_URL: chatRoomUrl,
    RECAPTCHA_SITE_KEY: reCaptchaSiteKey,
    RECAPTCHA_SECRET: reCaptchaSecretKey,
} = process.env;

const express = require("express");
const basicAuth = require("express-basic-auth");
const {
    RecaptchaV2,
} = require("express-recaptcha");

const low = require("lowdb");
const FileSync = require("lowdb/adapters/FileSync");
 
const adapter = new FileSync("data.json");
const db = low(adapter);

db.defaults({
    codes: [],
}).write();
  
const app = express();
const captcha = new RecaptchaV2(
    reCaptchaSiteKey, reCaptchaSecretKey,
);

const adminAuth = basicAuth({
    challenge: true,
    users: {
        "admin": chatRoomSecret,
    },
});

app.set("view engine", "ejs");
app.set("views", "views");

app.use(express.urlencoded({
    extended: true,
}));

app.get("/", (_, res) => {
    const captchaScript = captcha.render();
    res.render("index", {
        chatRoomName,
        chatRoomUrl,
        captchaScript,
    });
});

app.get("/admin", adminAuth, (_, res) => {
    res.render("admin", {
        chatRoomName,
    });
});

app.get("/submissions/:code", adminAuth, (req, res, next) => {
    if (!!req.params.code) {
        next();
        return;
    }
    res.status(400).send("bad request");
}, (req, res) => {
    const { code } = req.params;
    const item = db.get("codes").
        find((i) => i.code === code).
        value();
    if (!item) {
        res.status(404).send("not found");
        return;
    }
    res.status(200).send(item);
});

app.post("/submissions", captcha.middleware.verify, (req, res, next) => {
    if (!req.recaptcha.error) {
        next();
        return;
    }
    res.status(403).send("verification failed");
}, (_, res) => {
    const code = shortid.generate();
    const time = Date.now();
    db.get("codes").push({
        time, code,
    }).write();
    res.status(201).send({code});
});

app.listen(3000, () => {
    console.log(
        `Freyja is working for "${chatRoomName}" on`,
        "http://localhost:3000",
    );
});
