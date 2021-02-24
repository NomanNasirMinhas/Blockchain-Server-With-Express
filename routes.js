const shortid = require("short-id");
const IPFS = require("ipfs-api");
const ipfs = IPFS({ host: "ipfs.infura.io", port: 5001, protocol: "https" });
const { performance } = require("perf_hooks");
const fetch = require("node-fetch");

function routes(app, dbe, lms, accounts) {
  let db = dbe.collection("music-users");
  let music = dbe.collection("music-store");
  app.post("/register", (req, res) => {
    let email = req.body.email;
    let idd = shortid.generate();
    if (email) {
      db.findOne({ email }, (err, doc) => {
        if (doc) {
          res
            .status(400)
            .json({ status: "Failed", reason: "Already registered" });
        } else {
          db.insertOne({ email });
          res.json({ status: "success", id: idd });
        }
      });
    } else {
      res.status(400).json({ status: "Failed", reason: "wrong input" });
    }
  });

  app.post("/login", (req, res) => {
    let email = req.body.email;
    if (email) {
      db.findOne({ email }, (err, doc) => {
        if (doc) {
          res.json({ status: "success", id: doc.id });
        } else {
          res.status(400).json({ status: "Failed", reason: "Not recognised" });
        }
      });
    } else {
      res.status(400).json({ status: "Failed", reason: "wrong input" });
    }
  });
  app.post("/upload", async (req, res) => {
    let buffer = Buffer.from(req.body.buffer);
    let name = req.body.name;
    let title = req.body.title;
    let id = shortid.generate() + shortid.generate();
    if (buffer && title) {
      let ipfsHash = await ipfs.add(buffer);
      let hash = ipfsHash[0].hash;
      lms
        .sendIPFS(id, hash, { from: accounts[0] })
        .then((_hash, _address) => {
          music.insertOne({ id, hash, title, name });
          res.json({ status: "success", id });
        })
        .catch((err) => {
          res
            .status(500)
            .json({ status: "Failed", reason: "Upload error occured" });
        });
    } else {
      res.status(400).json({ status: "Failed", reason: "wrong input" });
    }
  });
  app.get("/getEmail/:email", (req, res) => {
    if (req.params.email) {
      db.findOne({ email: req.params.email }, (err, doc) => {
        if (doc) {
          let data = music.find().toArray();
          res.json({ status: "success", data });
        }
      });
    } else {
      res.status(400).json({ status: "Failed", reason: "wrong input" });
    }
  });

  app.get("/getData/:id", async (req, res) => {
    let id = req.params.id;
    var t0 = performance.now();
    var type= req.params.id.toString();
    console.log("ID = ", id);
    try {
      if (req.params.id) {
        // db.findOne({email:req.body.email},(err,doc)=>{
        if (localStorage.getItem(type) != undefined) {
          lms.getHash(localStorage.getItem(type), { from: accounts[0] }).then(async (hash) => {
            let data = await ipfs.files.get(hash);
            // localStorage.setItem(type, Number(performance.now() - t0).toString());
            res.json({ responseTime: Number(performance.now() - t0).toString(), cached:true, result: JSON.parse(data[0].content.toString()) });
          });
        } else {
            var result = await fetch(`https://jsonplaceholder.typicode.com/posts/${Number(type)}`);
            result = await result.json();
            var t0 = performance.now();

            let buffer = Buffer.from(JSON.stringify(result));
            let name = result.userId;
            let title = result.title;
            let id = shortid.generate() + shortid.generate();
            if (buffer && title) {
            let ipfsHash = await ipfs.add(buffer);
            let hash = ipfsHash[0].hash;
            localStorage.setItem(type, id.toString());
            lms
                .sendIPFS(id, hash, { from: accounts[0] })
                .then((_hash, _address) => {
                music.insertOne({ id, hash, title, name });
                // localStorage.setItem(type, Number(performance.now() - t0).toString());
                res.status(201).json({ result: result, cached:false, responseTime: Number(performance.now() - t0).toString()});
                })
                .catch((err) => {
                    res.status(400).json({ message: err.message });
                });
            } else {
            res.status(400).json({ status: "Failed", reason: "wrong input" });
            }
        }
        // })
      } else {
        res.status(400).json({ status: "Failed", reason: "wrong input" });
      }
    } catch (err) {
      res.status(400).json({ message: err.message });
    }
  });
}

module.exports = routes;
