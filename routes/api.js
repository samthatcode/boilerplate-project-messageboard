'use strict';

const bcrypt = require('bcrypt');

const mongoose = require('mongoose');

// Connect to MongoDB
mongoose.connect(process.env.MONGO_URL, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  serverSelectionTimeoutMS: 5000
});

const BoardModel = require('../models/model').Board;
const ThreadModel = require('../models/model').Thread;
const ReplyModel = require('../models/model').Reply;

const saltRounds = 13;

module.exports = function (app) {
  console.log("At least something");
  
  app.route('/api/threads/:board').post((req, res) => {
    const { text, delete_password } = req.body;
    let board = req.params.board;
    if(!board) {
      board = req.params.board;
    }
    const newThread = new ThreadModel({
      text: text,
      delete_password: bcrypt.hashSync(delete_password, saltRounds),
      replies: [],
    });
    BoardModel.findOne({ name: board }, (err, Boarddata) => {
      if(!Boarddata) {
        const newBoard = new BoardModel({
          name: board,
          threads: [],
        });
        newBoard.threads.push(newThread);
        
        newBoard.save((err, data) => {
          if(err || !data) {
            console.log(err);
            res.send("There was an error saving in post");
          } else {
            const url = "https://" + req.headers.host + '/b/' + req.params.board + '/';
            res.redirect(url);
          }
        });
      } else {
        Boarddata.threads.push(newThread);
        Boarddata.save((err, data) => {
          if(err || !data) {
            console.log(err);
            res.send("There was an error saving in post");
          } else {
            const url = "https://" + req.headers.host + '/b/' + req.params.board + '/';
            res.redirect(url);
          }
        });
      }
    });
  })
  .get((req, res) => {
    const board = req.params.board;
    BoardModel.findOne({ name: board }, (err, data) => {
      if(!data) {
        console.log("No board with this name");
        res.json({ error: "No board with this name" });
      } else {
        const threads = data.threads.map((thread) => {
          const {
            _id,
            text,
            created_on,
            bumped_on,
            replies,
          } = thread;
          replies.sort((first, second) => first.created_on < second.created_on ? 1 : -1);
          let thisReplies = [];
          for(let i = 0; i < 3 && i < replies.length; i++) {
            let reply = {};
            const {
              _id,
              text,
              created_on
            } = replies[i];
            reply._id = _id;
            reply.text = text;
            reply.created_on = created_on;
            thisReplies.push(reply);
          }
          thisReplies.reverse();
          return {
            _id,
            text,
            created_on,
            bumped_on,
            replies: thisReplies,
            replycount: replies.length,
          };
        });
        threads.sort((first, second) => first.bumped_on < second.bumped_on ? 1 : -1);
        let thisThreads = [];
        for(let i = 0; i < 10 && i < threads.length; i++) {
          thisThreads.push(threads[i]);
        }
        // console.log("Returned Threads: ");
        // console.log(thisThreads);
        res.json(thisThreads);
      }
    });
  }).put((req, res) => {
  console.log("put", req.body);
  const { thread_id } = req.body;
  const board = req.params.board;
    console.log(board)
  
  BoardModel.findOne({ name: board }, (err, boardData) => {
    if (!boardData || err || !boardData.threads) {
      res.status(404).json({ error: "Board not found" });
    } else {
      console.log(boardData)
      const date = new Date();
      const reportedThread = boardData.threads.id(thread_id); // Use the id method to find the specific thread
      console.log(reportedThread)
      
      if (!reportedThread) {
        res.status(404).json({ error: "Thread not found" });
        console.log("wtf")
      } else {
        reportedThread.reported = true;
        reportedThread.bumped_on = date;
        
        boardData.save((err, updatedData) => {
          if (!err || updatedData) {
            res.send("reported");
            console.log("save")
          }
        });
      }
    }
  });
})
.delete((req, res) => {
  const { thread_id, delete_password } = req.body;
  const board = req.params.board;
  console.log(board)
  
  BoardModel.findOne({ name: board }, (err, boardData) => {
    if (err || !boardData || !boardData.threads) {
      res.status(500).json({ error: 'An error occurred while accessing the board data.' });
      console.log("err")
      return;
    }

    const threadToDelete = boardData.threads.id(thread_id);
    console.log(threadToDelete)
    
    if (!threadToDelete) {
      res.status(404).json({ error: 'Thread not found' });
      console.log("not found")
      return;
    }

    if (bcrypt.compareSync(delete_password, threadToDelete.delete_password)) {
      threadToDelete.remove();
      boardData.save((err, updatedData) => {
        if (err) {
          res.status(500).json({ error: 'An error occurred while saving updated data.' });
        } else {
          res.send('success');
        }
      });
    } else {
      res.status(401).send('incorrect password');
    }
  });
});


    
  app.route('/api/replies/:board').post((req, res) => {
    // console.log("Came here!");
    const { thread_id, text, delete_password } = req.body;
    const board = req.params.board;
    const date = new Date();
    const newReply = new ReplyModel({
      text: text,
      delete_password: bcrypt.hashSync(delete_password, saltRounds),
      created_on: date,
      bumped_on: date,
      reported: false,
    });
    BoardModel.findOne({ name: board }, (err, boardData) => {
      if(!boardData) {
        res.json("error", "Board not found");
      } else {
        let threadToAddReply = boardData.threads.id(thread_id);
        threadToAddReply.bumped_on = date;
        threadToAddReply.replies.push(newReply);
        boardData.save((err, updatedData) => {
          // res.json(updatedData);
          const url = "https://" + req.headers.host + '/b/' + req.params.board + '/' + req.body.thread_id;
          // console.log(url);
          res.redirect(url);
        });
      }
    });
  }).get((req, res) => {
    // console.log("/api/replies/:board GET request query: ");
    // console.log(req.query);
    const board = req.params.board;
    BoardModel.findOne({ name: board }, (err, data) => {
      if(!data) {
        console.log("No board with this name");
        res.json({ error: "No board with this name" });
      } else {
        const thread = data.threads.id(req.query.thread_id);
        const {
          _id,
          text,
          created_on,
          bumped_on,
          replies
        } = thread;
        let thisReplies = [];
        for(let i = 0; i < replies.length; i++) {
          let reply = {};
            const {
              _id,
              text,
              created_on
            } = replies[i];
            reply._id = _id;
            reply.text = text;
            reply.created_on = created_on;
            thisReplies.push(reply);
        }
        let newThread = {};
        newThread._id = _id;
        newThread.text = text;
        newThread.created_on = created_on;
        newThread.bumped_on = bumped_on;
        newThread.replies = [...thisReplies];
        newThread.replycount = replies.length;
        res.json(newThread);
      }
    });
  }).put((req, res) => {
    console.log("Some request: ");
    const { thread_id, reply_id } = req.body;
    const board = req.params.board;
    BoardModel.findOne({ name: board }, (err, data) => {
      if(!data) {
        console.log("No board with this name");
        res.json({ error: "No board with this name" });
      } else {
        const date = new Date();
        let thread = data.threads.id(thread_id);
        let reply = thread.replies.id(reply_id);
        reply.reported = true;
        reply.created_on = date;
        reply.bumped_on = date;
        data.save((err, updatedData) => {
          if(!err|| updatedData) {
            res.send("reported");
          }
        });
      }
    });
  })
  .delete((req, res) => {
    const { thread_id, reply_id, delete_password } = req.body;
    const board = req.params.board;

    BoardModel.findOne({ name: board }, (err, boardData) => {
      if (err || !boardData) {
        console.log("Error while finding board:", err);
        res.status(500).json({ error: "An error occurred while accessing the board data." });
        return;
      }

      let thread = boardData.threads.id(thread_id);
      if (!thread) {
        console.log("Thread not found");
        res.status(404).json({ error: "Thread not found" });
        return;
      }

      let reply = thread.replies.id(reply_id);
      if (!reply) {
        console.log("Reply not found");
        res.status(404).json({ error: "Reply not found" });
        return;
      }

      if (bcrypt.compareSync(delete_password, reply.delete_password)) {
        reply.text = "[deleted]";
        boardData.save((err, updatedData) => {
          if (err || !updatedData) {
            console.log("Error while saving data:", err);
            res.status(500).json({ error: "An error occurred while saving updated data." });
            console.log("hell not again")
          } else {
            console.log(updatedData)
            res.send("success");
          }
        });
      } else {
        res.status(401).send("incorrect password");
      }
    });
  });
}