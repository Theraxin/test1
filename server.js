"use strict"
var qstring = require("querystring");
var http = require("http");
var crypto = require("crypto");
var connect = require("connect");
var fs = require("fs");
var app = http.createServer(connect().use(connect.compress()).use(cardRedirect).use(connect.static(__dirname)).use(loginAuth));
var io = require("socket.io").listen(app.listen(13602));
var redis = require("redis"), db = redis.createClient();
var etgutil = require("./etgutil");

function loginRespond(res, servuser, pass){
	if(!servuser.name){
		servuser.name = servuser.auth;
	}
	function postHash(err, key){
		if (err){
			res.writeHead("503");
			res.end();
			return;
		}
		key = key.toString("base64");
		if (!servuser.auth){
			servuser.auth = key;
		}else if (servuser.auth != key){
			console.log("Failed login "+servuser.name);
			res.writeHead("404");
			res.end();
			return;
		}
		var user = useruser(servuser), day = getDay();
		if (!servuser.oracle || servuser.oracle < day){
			servuser.oracle = day;
			user.oracle = true;
		}
		res.writeHead("200");
		db.hgetall("Q:" + user.name, function (err, obj) {
		    user.quest = obj;
            res.end(JSON.stringify(user));
		});
		
	}
	if(!servuser.salt){
		servuser.salt = crypto.pseudoRandomBytes(16).toString("base64");
		servuser.iter = 100000;
	}
	if (pass && pass.length){
		crypto.pbkdf2(pass, servuser.salt, parseInt(servuser.iter), 64, postHash);
	}else postHash(null, servuser.name);
}
function loginAuth(req, res, next){
	if (req.url.indexOf("/auth?") == 0){
		var paramstring = req.url.substring(6);
		var params = qstring.parse(paramstring);
		var name = (params.u || "").trim();
		if (!name.length){
			res.writeHead("404");
			res.end();
			return;
		}else if (name in users){
			loginRespond(res, users[name], params.p);
		}else{
			db.hgetall("U:"+name, function (err, obj){
				users[name] = obj || {name: name};
				prepuser(users[name]);
				loginRespond(res, users[name], params.p);
			});
		}
	}else next();
}
function cardRedirect(req, res, next){
	if (req.url.match(/^\/Cards\/...\.png$/)){
		var code = req.url.substr(7, 3), intCode = parseInt(code, 32);
		if (intCode >= 7000){
			fs.exists(__dirname + req.url, function(exists){
				if (!exists){
					req.url = "/Cards/" + (intCode-2000).toString(32) + ".png";
				}
				next();
			});
			return;
		}
	}
	next();
}

var users = {};
var duels = {};
var trades = {};
var usersock = {};
var rooms = {};
var sockinfo = {};
process.on("SIGTERM", process.exit).on("SIGINT", process.exit);
process.on("exit", function(){
	for(var u in users){
		db.hmset("U:"+u, users[u]);
	}
	db.quit();
});
function dropsock(data){
	if (this.id in sockinfo){
		var foe = sockinfo[this.id].foe;
		if (foe){
			foe.emit("foeleft");
		}
		delete sockinfo[this.id];
	}
}
function foeEcho(socket, event){
	socket.on(event, function(data){
		var foe =  sockinfo[this.id].trade ? sockinfo[this.id].trade.foe : sockinfo[this.id].foe;
		if (foe && foe.id in sockinfo){
			foe.emit(event, data);
		}
	});
}
function userEvent(socket, event, func){
	socket.on(event, function(data){
		var u=data.u;
		console.log(u+": "+event);
		if (!(u in users)){
			db.hgetall("U:"+u, function(err, obj){
				if (obj){
					prepuser(obj);
					users[u] = obj;
					if (data.a == obj.auth){
						usersock[u] = socket;
						func.call(socket, data, obj);
					}
				}
			});
		}else if (data.a == users[u].auth){
			usersock[u] = socket;
			func.call(socket, data, users[u]);
		}
	});
}
function prepuser(servuser){
	servuser.gold = parseInt(servuser.gold || 0);
}
function useruser(servuser){
    return {
        auth: servuser.auth,
        name: servuser.name,
        deck: servuser.deck,
        pool: servuser.pool,
        gold: servuser.gold,
        ocard: servuser.ocard,
        starter: servuser.starter ? servuser.starter : null,
	};
}
function getDay(){
	return Math.floor(Date.now()/86400000);
}
//Aether:    
var starter = [
	"0156501598015990d4sa034sd014td034vj0152l0155t0158q015c1015cc015fi015f6015if015ii015lb015ll015os015oj015rl015v3015uv0161s018pi",
	"01502034sa014t3014sd0b4vc024vi014vj014vh014vv014vp034vs024vd014ve014vf055uk015us015v3015uq015up015uv018pt",
	"0153102532034sa014sd014t40c52g0252i0252j0252k0252n0152p0152t0152r0152h045bs025cb025cr018pn",
	"0156203564025650159502599034sa014sd014t50b55k0155q0255t0255r0255l0155o0458o0158t0258q018pm",
	"03590015910159403599034sa014sd014t40b58o0258u0158p0258q0158s0158r045rg025ri025rr015rn018ps",
	"034sa014sd014td0c5bs015bu025c1015cb025c0015c8025c7015c6015cr015c3015bt045i4015ia015i6025il025ie018ps",
	"034sa014sd024t40b5f0025f1025f3015f4025fh025fi025fa015f5025fc015f2045l8025lp025lr018pq",
	"02565034sa024sd014td0455k0255t0155r0c5i4025i8035i6025ip025ie015i9025ig015id018pl",
	"034sa014sd014tb0b5l8025lo025lp035lb015ld025lm015ln025ll015la045oc025on025os015oe015or018pr",
	"034sa014sd014t4055f0015f3025f4015f6015fc0c5oc025od015og025os015oh015oe025ou015om025or015of018po",
	"03627034sa024sd014t40c5rg025ri025rr015rl025ru015s0015rn015rm0561o0261q0261t018pu",
	"034sa014sd014t40452g0152p0252t0a5uk035um025un015us025v3015uq035ut015up015vb015uo025uv015ul018pk",
	"015020262002627034sa014sd014t4064vc024vp034vs0b61o0261q0361s0261t0161v018pj"
];

io.sockets.on("connection", function(socket) {
	sockinfo[socket.id] = {};
	socket.on("disconnect", dropsock);
	socket.on("reconnect_failed", dropsock);
	userEvent(socket, "inituser", function(data, user) {
		var u=data.u;
		var startdeck = starter[data.e];
		user.deck = startdeck || starter[0];
		user.starter = user.deck;
		user.pool = [];
		user.quest = { necromancer: 1 };
		this.emit("userdump", useruser(user));
	});
	userEvent(socket, "logout", function(data, user) {
		var u=data.u;
		db.hmset("U:"+u, user);
		delete users[u];
	});
	userEvent(socket, "delete", function(data, user) {
	    var u = data.u;
	    db.del("U:" + u);
	    db.del("Q:" + u);
		delete users[u];
	});
	userEvent(socket, "addcard", function(data, user) {
	    // Anything using this should eventually be serverside
		user.pool = etgutil.addcard(user.pool, data.c);
		if (data.g){
			user.gold += data.g;
		}
		if (data.o){
			user.ocard = data.o;
		}
	});
	userEvent(socket, "subgold", function (data, user) {
	    user.gold -= data.g;
	});
	userEvent(socket, "addgold", function (data, user) {
	    user.gold += data.g;
	});
	userEvent(socket, "setdeck", function(data, user){
		user.deck = data.d;
	});
	userEvent(socket, "setarena", function(data, user){
		var au="A:" + data.u;
		if (!user.ocard){
			return;
		}
		db.hget(au, "card", function(err, card){
			var adeck = etgutil.addcard(data.d, user.ocard, 5);
			if (card != user.ocard){
				db.hmset(au, {day: getDay(), deck: adeck, card: user.ocard, win:0, loss:0});
				db.zadd("arena", 0, data.u);
			}else{
				db.hset(au, "deck", adeck);
			}
		});
	});
	userEvent(socket, "arenainfo", function(data, user){
		db.hgetall("A:" + data.u, function(err, obj){
			socket.emit("arenainfo", obj);
		});
	});
	userEvent(socket, "arenatop", function(data, user){
		db.zrange("arena", 0, 9, function(err, obj){
			socket.emit("arenatop", obj);
		});
	});
	userEvent(socket, "modarena", function(data, user){
		db.hincrby("A:"+data.aname, data.won?"win":"loss", 1);
		db.zincrby("arena", data.won?1:-1, data.aname);
	});
	userEvent(socket, "foearena", function(data, user){
		db.zcard("arena", function(err, len){
			if (!len)return;
			var idx = Math.floor(Math.random()*Math.min(len, 20));
			db.zrange("arena", idx, idx, function(err, aname){
				console.log("deck: "+ aname + " " + idx);
				db.hgetall("A:"+aname, function(err, adeck){
					var day = getDay();
					var seed = Math.random();
					var first = seed<.5;
					socket.emit("foearena", {seed: seed*etgutil.MAX_INT, first: first, name: aname, hp:Math.max(202-Math.pow(2, 1+day-adeck.day), 100), deck: adeck.deck})
				});
			});
		});
	});
	userEvent(socket, "upgrade", function (data, user) {
	    user.pool = etgutil.addcard(user.pool, data.card, -6);
	    user.pool = etgutil.addcard(user.pool, data.newcard);
	});
	userEvent(socket, "transmute", function(data, user){
		var rm = etgutil.decodedeck(data.rm), add = etgutil.decodedeck(data.add);
		for(var i=0; i<rm.length; i++){
			user.pool = etgutil.addcard(user.pool, rm[i], -1);
		}
		for(var i=0; i<add.length; i++){
			user.pool = etgutil.addcard(user.pool, add[i]);
		}
		user.deck = data.add;
	});
	userEvent(socket, "add", function (data, user) {
		var add = etgutil.decodedeck(data.add);
		for (var i = 0; i < add.length; i++) {
			user.pool = etgutil.addcard(user.pool, add[i]);
		}
	});
	userEvent(socket, "foewant", function(data){
		var u=data.u, f=data.f;
		if (u == f){
			return;
		}
		console.log(u + " requesting " + f);
		sockinfo[this.id].deck = data.deck;
		if (f in users){
			if (duels[f] == u) {
				delete duels[f];
				var seed = Math.random() * etgutil.MAX_INT;
				var first = seed < etgutil.MAX_INT / 2;
				sockinfo[this.id].foe = usersock[f];
				sockinfo[usersock[f].id].foe = this;
				var deck0 = sockinfo[usersock[f].id].deck, deck1 = data.deck;
				this.emit("pvpgive", { first: first, seed: seed, deck: deck0, urdeck: deck1, foename:f});
				usersock[f].emit("pvpgive", { first: !first, seed: seed, deck: deck1, urdeck: deck0, foename:u});
			} else {
				duels[u] = f;
				usersock[f].emit("chat", { message: u + " wants to duel with you!", mode: "info" });
				this.emit("chat", { mode: "info", message: "You have sent a PvP request to " + f + "!" });
			}
		}
	});
	userEvent(socket, "canceltrade", function (data, user) {
		sockinfo[this.id].trade.foe.emit("tradecanceled");
		sockinfo[this.id].trade.foe.emit("chat", { mode:"info", message: data.u + " have canceled the trade."})
		delete sockinfo[sockinfo[this.id].trade.foe.id].trade;
		delete sockinfo[this.id].trade;
	});
	userEvent(socket, "confirmtrade", function (data, user) {
		var u = data.u, thistrade = sockinfo[this.id].trade, thattrade = thistrade.foetrade;
		if (!thistrade){
			return;
		}
		thistrade.tradecard = data.card;
		thistrade.oppcard = data.oppcard;
		if (thattrade.accepted) {
			var other = thistrade.foe;
			var player1Card = thistrade.tradecard, player2Card = thattrade.tradecard;
			//if (player1Card == thattrade.oppcard && thistrade.oppcard == player2Card) {
			user.pool = etgutil.addcard(user.pool, player1Card, -1);
			user.pool = etgutil.addcard(user.pool, player2Card);
			users[thistrade.foename].pool = etgutil.addcard(users[thistrade.foename].pool, player2Card, -1);
			users[thistrade.foename].pool = etgutil.addcard(users[thistrade.foename].pool, player1Card);
			this.emit("tradedone", { oldcard: player1Card, newcard: player2Card });
			other.emit("tradedone", { oldcard: player2Card, newcard: player1Card });
			delete sockinfo[this.id].trade;
			delete sockinfo[other.id].trade;
			//}
		} else {
			thistrade.accepted = true;
		}
	});
	userEvent(socket, "tradewant", function (data) {
		var u = data.u, f = data.f;
		if (u == f) {
			return;
		}
		console.log(u + " requesting " + f);
		if (f in users) {
			if (trades[f] == u) {
				delete trades[f];
				sockinfo[this.id].trade = {foe: usersock[f], foename: f };
				sockinfo[usersock[f].id].trade = {foe: this, foename: u };
				sockinfo[this.id].trade.foetrade = sockinfo[usersock[f].id].trade;
				sockinfo[usersock[f].id].trade.foetrade = sockinfo[this.id].trade;
				this.emit("tradegive", { first: false });
				usersock[f].emit("tradegive", { first: true });
			} else {
			    trades[u] = f;
			    if (usersock[f]) usersock[f].emit("chat", { mode: "info", message: u + " wants to trade with you!" });
			    this.emit("chat", { mode: "info", message: "You have sent a trade request to " + f + "!" });
			}
		}
	});
	userEvent(socket, "passchange", function(data, user){
		var pass = data.p || "";
		if (!pass.length){
			var hkey = "U:"+user.name;
			db.hdel(hkey, "salt");
			db.hdel(hkey, "iter");
			db.hset(hkey, "auth", user.name);
			delete user.salt;
			delete user.iter;
			user.auth = user.name;
			socket.emit("passchange", user.name);
		}else{
			crypto.pbkdf2(pass, user.salt, parseInt(user.iter), 64, function(err, key){
				if (!err){
					user.auth = key.toString("base64");
					socket.emit("passchange", user.auth);
				}
			});
		}
	});
	userEvent(socket, "chat", function (data) {
		delete data.a;
		var message = data.message.split(" ");
		if (message[0] == "/w") {
			if (usersock[message[1]]) {
				usersock[message[1]].emit("chat", { message: message.slice(2).join(" "), mode: "pm", u: data.u })
				socket.emit("chat", { message: message.slice(2).join(" "), mode: "pm", u: "To " + message[1] })
			}
			else
				socket.emit("chat", { mode: "info", message: message[1] + " is not here right now." })
		}
		else
			io.sockets.emit("chat", data);
	});
	userEvent(socket, "updatequest", function (data, user) {
	    var qu = "Q:" + data.u;
	    db.hset(qu, data.quest, data.newstage);
	});
	socket.on("guestchat", function (data) {
        io.sockets.emit("chat", {message: data.message, u:"Guest" + (data.name ? "_" + data.name : ""), mode:"guest"})
	});
	socket.on("pvpwant", function(data) {
		var pendinggame=rooms[data.room];
		console.log(this.id + ": " + (pendinggame?pendinggame.id:"-"));
		sockinfo[this.id].deck = data.deck;
		if (this == pendinggame){
			return;
		}
		if (pendinggame && pendinggame.id in sockinfo){
			var seed = Math.random()*etgutil.MAX_INT;
			var first = seed<etgutil.MAX_INT/2;
			sockinfo[this.id].foe = pendinggame;
			sockinfo[pendinggame.id].foe = this;
			var deck0=sockinfo[pendinggame.id].deck, deck1=data.deck;
			this.emit("pvpgive", {first:first, seed:seed, deck:deck0, urdeck:deck1});
			pendinggame.emit("pvpgive", {first:!first, seed:seed, deck:deck1, urdeck:deck0});
			delete rooms[data.room];
		}else{
			rooms[data.room] = this;
		}
	});
	foeEcho(socket, "endturn");
	foeEcho(socket, "cast");
	foeEcho(socket, "foeleft");
	foeEcho(socket, "mulligan");
	foeEcho(socket, "cardchosen");
});