const express = require('express');
const router = express.Router();


/* GET home page. */
router.get('/', function(req, res, next) {
  res.render('index', { title: 'HealWorld UAT-API : Endpoints V2 ยายมีขายหอย'});
});

module.exports = router;
