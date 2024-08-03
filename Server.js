import express from "express";
import mongoose from "mongoose";
import User from "./models/User.js";
import Conversation from "./models/Conversation.js";
import gridfsStream from "gridfs-stream";
import multer from "multer";
import { GridFsStorage } from "multer-gridfs-storage";
import cors from "cors";
import bodyParser from "body-parser";
import { Server } from "socket.io";
import { createServer } from "http";
import dotenv from "dotenv"
dotenv.config()

let conn = await mongoose.connect(process.env.MONGO_URL);

const onlineUsers = new Set();

const app = express();
const port = 9000;

const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
    credentials: true,
  },
});

app.use(
  cors({
    origin: "*",
    methods: ["GET", "POST"],
    credentials: true,
  })
);
app.use(bodyParser.json());

const con = mongoose.createConnection(process.env.MONGO_URL);

// Init gfs
let gfs, gridFsBucket;

con.once("open", () => {
  gridFsBucket = new mongoose.mongo.GridFSBucket(con.db, {
    bucketName: "uploads",
  });

  gfs = gridfsStream(con.db, mongoose.mongo);
  gfs.collection("uploads");
});

// Create storage engine
const storage = new GridFsStorage({
  url: "mongodb://localhost:27017/quickchat",
  file: (req, file) => {
    return {
      bucketName: "uploads",
      filename: file.originalname,
    };
  },
});
const upload = multer({ storage });

app.get("/", (req, res) => {
  res.send("Hello World!");
});

app.post("/upload", upload.single("file"), (req, res) => {
  res.status(201).send(req.file);
});

// Retrieve file endpoint
app.get("/files/:filename", async (req, res) => {
  let file = await gfs.files.findOne({ filename: req.params.filename });
  if (!file) {
    return res.status(404).json({ err: "File not found" });
  }
  const readStream = gridFsBucket.openDownloadStream(file._id);
  readStream.pipe(res);
});

app.post("/login", async (req, res) => {
  let email = req.body.email;
  let username = req.body.username;
  let profile = req.body.image;
  let uid = req.body.uid;
  let currectuser = await User.findOne({ email: email });
  if (!currectuser) {
    const user = new User({
      username: username,
      email: email,
      profilepic: profile,
      uid: uid,
      friends: "you have no any friend",
    });
    await user.save();
  } else {
    let a = await User.updateOne({ email: email }, { $set: { uid: uid } });
  }
  let currectuser1 = await User.findOne({ email: email });
  let user = currectuser1.friends;
  res.send({ user });
});

app.post("/findfriend", async (req, res) => {
  let femail = req.body.femail;
  let uemail = req.body.email;
  let currectuser = await User.findOne({ email: femail });
  if (currectuser) {
    let frienddata = {
      friendname: currectuser.username,
      friendemail: currectuser.email,
      friendprofile: currectuser.profilepic,
    };

    let b = await User.findOne({
      email: uemail,
      friends: { $elemMatch: { friendemail: femail } },
    });
    if (b) {
      let a = await User.findOne({ email: uemail });
      let user = a.friends;
      res.send({ success: "This user is already exist", user });
    } else {
      let b = await User.findOne({ email: uemail });
      let user1 = b.friends[0];
      if (user1 == "you have no any friend") {
        let friend = await User.updateOne(
          { email: uemail },
          { $set: { friends: frienddata } }
        );
      } else {
        let friend = await User.updateOne(
          { email: uemail },
          { $push: { friends: frienddata } }
        );
      }
      let a = await User.findOne({ email: uemail });
      let user = a.friends;
      res.send({ success: "user succressfully added", user });
    }
  } else {
    let a = await User.findOne({ email: uemail });
    let user = a.friends;
    res.send({ success: "This user is not exist", user });
  }
});

app.post("/getsocketid", async (req, res) => {
  let femail = req.body.femail;
  let user = await User.findOne({ email: femail });
  let id = user.uid;
  res.send({ id });
});

app.post("/setconversation", async (req, res) => {
  let sender = req.body.sender;
  let receiver = req.body.receiver;

  let conversation = await Conversation.findOne({
    $or: [
      { senderemail: sender, receiveremail: receiver },
      { senderemail: receiver, receiveremail: sender },
    ],
  });

  if (!conversation) {
    const newconversation = new Conversation({
      senderemail: sender,
      receiveremail: receiver,
    });
    await newconversation.save();
    let conversation = await Conversation.findOne({
      $or: [
        { senderemail: sender, receiveremail: receiver },
        { senderemail: receiver, receiveremail: sender },
      ],
    });
    let id = conversation._id;
    res.send({ id });
  } else {
    let id = conversation._id;
    res.send({ id });
  }
});

app.post("/getmessages", async (req, res) => {
  const id = req.body.id;
  let data = await Conversation.findOne({ _id: id });
  if (data) {
    let messages = data.messages;
    res.send({ messages });
  } else {
    res.send({ success: null });
  }
});
app.post("/setmessages", async (req, res) => {
  const id = req.body.id;
  const msg = req.body.messages;
  let data = await Conversation.updateOne(
    { _id: id },
    { $push: { messages: msg } }
  );
  res.send({ success: true });
});

app.post("/deletechat", async (req, res) => {
  let femail = req.body.femail;
  let uemail = req.body.email;

  await User.updateOne(
    { email: uemail },
    { $pull: { friends: { friendemail: femail } } }
  );
  let a = await User.findOne({ email: uemail });
  let user = a.friends;
  res.send({ user });
});

io.on("connection", (socket) => {
  socket.emit("welcome", `welcome to the server,${socket.id}`);

  socket.on("message", (data) => {
    let id = data.id;
    let messages = data.messages;
    let cid = data.cid;
    let type = data.type;
    let time = data.time;
    io.to(id).emit("receive-msg", {
      messages: messages,
      id: socket.id,
      cid: cid,
      type: type,
      time: time,
    });
  });

  const userEmail = socket.handshake.query.email;
  onlineUsers.add(userEmail);
  io.emit("online-users", Array.from(onlineUsers));

  socket.on("disconnect", () => {
    onlineUsers.delete(userEmail);
    io.emit("online-users", Array.from(onlineUsers));
  });
});

server.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});
