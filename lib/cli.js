(function() {
    var program = require("commander");
    var os = require('os');
    var fs = require('fs');
    var http = require('http');
    var zlib = require('zlib');
    var opensubtitles = require('opensubtitles-client');
    var kickass = require('./kickass.js');
    var limetorrents = require('./limetorrents.js');
    var extratorrent = require('./extratorrent.js');
    var config = require('../config.js');
    var language = require('../lang.js');
    var chalk = require('chalk');
    var prompt = require('cli-prompt');
    var spawn = require('child_process').spawn;
    var appRoot = require('app-root-path');
    //that's so dutty of you
    var conf_file = appRoot.path.split('bin').join('') + "/config.js";

    //load in values from config
    var conf = config.getConfig();
    var kickass_url = conf[0].kickass_url;
    var limetorrents_url = conf[0].limetorrents_url;
    var extratorrent_url = conf[0].extratorrent_url;
    var peerflix_player = conf[0].peerflix_player;
    var peerflix_player_arg = conf[0].peerflix_player_args;
    var peerflix_port = conf[0].peerflix_port;
    var peerflix_command = conf[0].peerflix_command;
    var use_subtitle = conf[0].use_subtitle;
    var subtitle_language = conf[0].subtitle_language;


    //load in language settings
    var lang = language.getEn();
    var torrent_site = lang[0].torrent_site;
    var search_torrent = lang[0].search_torrent;
    var torrent_site_num = lang[0].torrent_site_num;
    var select_torrent = lang[0].select_torrent;
    var site_error = lang[0].site_error;

    var peerflix_subtitle = "";

    /* hardcode till added */
    cat = "";
    page = "1";

    program
    .option('-c, --config', 'config')
    .parse(process.argv);

    if(program.config){
        spawn(program.args[0], [conf_file], {
          stdio: 'inherit'
        });
    } else {
      firstPrompt();
    }

    function firstPrompt(){
      console.log(chalk.green.bold(torrent_site));
      console.log(chalk.magenta.bold('(k) ') + chalk.yellow.bold("Kickass"));
      console.log(chalk.magenta.bold('(l) ') + chalk.yellow.bold("Limetorrents"));
      console.log(chalk.magenta.bold('(e) ') + chalk.yellow.bold("Extratorrent"));
      //console.log(chalk.green.bold(torrent_site_num));

      prompt(chalk.green.bold(torrent_site_num), function (val) {
        torrentSite(val);
      });
    }

    function torrentSite(site){
      //console.log(chalk.green.bold(search_torrent));
      prompt(chalk.green.bold(search_torrent), function (val) {

        if(val){

          if(site === "k"){
            kickassSearch(val);
          } else if (site === "l"){
            limetorrentSearch(val);
          } else if(site === "e"){
            extratorrentSearch(val);
          } else {
            console.log("");
            console.log(chalk.white.bgRed.bold(site_error));
            console.log("");
            firstPrompt();
          }

        }

      });
    }

    function extratorrentSearch(query){
      console.log(chalk.green.bold("searching for ") + chalk.bold.blue(query) + chalk.bold.red(" (*note Extratorrent does not sort by seeds)"));
      extratorrent.search(query, cat, page, extratorrent_url).then(function(data) {

        for (var torrent in data) {
          var number = data[torrent].torrent_num;
          var title = data[torrent].title;
          var size = data[torrent].size;
          var seed = data[torrent].seeds;
          var leech = data[torrent].leechs;

          console.log(
            chalk.magenta.bold(number) + chalk.magenta.bold('\) ') + chalk.yellow.bold(title) + (' ') + chalk.blue.bold(size) + (' ') + chalk.green.bold(seed) + (' ') + chalk.red.bold(leech)
          );
        }

        selectTorrent(data);

      });
    }

    function limetorrentSearch(query){
      console.log(chalk.green.bold("searching for ") + chalk.bold.blue(query));
      limetorrents.search(query, cat, page, limetorrents_url).then(function(data) {

        for (var torrent in data) {
          var number = data[torrent].torrent_num;
          var title = data[torrent].title;
          var size = data[torrent].size;
          var seed = data[torrent].seeds;
          var leech = data[torrent].leechs;

          console.log(
            chalk.magenta.bold(number) + chalk.magenta.bold('\) ') + chalk.yellow.bold(title) + (' ') + chalk.blue.bold(size) + (' ') + chalk.green.bold(seed) + (' ') + chalk.red.bold(leech)
          );
        }

        selectTorrent(data);

      });
    }

    function kickassSearch(query) {
      console.log(chalk.green.bold("searching for ") + chalk.bold.blue(query));
      kickass.search(query, cat, page, kickass_url).then(function(data) {

        for (var torrent in data) {
          var number = data[torrent].torrent_num;
          var title = data[torrent].title;
          var size = data[torrent].size;
          var seed = data[torrent].seeds;
          var leech = data[torrent].leechs;

          console.log(
            chalk.magenta.bold(number) + chalk.magenta.bold('\) ') + chalk.yellow.bold(title) + (' ') + chalk.blue.bold(size) + (' ') + chalk.green.bold(seed) + (' ') + chalk.red.bold(leech)
          );
        }

        selectTorrent(data);

      });
    }

    function selectTorrent(data) {
      prompt(chalk.green.bold(select_torrent), function (val) {
        number = val -1;
        //console.log('Streaming ' + chalk.green.bold(data[number].title));
        torrent = data[number].torrent_link;
        torrent_title = data[number].title;

        if(use_subtitle === "true"){

          getSubtitles(torrent, torrent_title);

        } else if(use_subtitle === "false"){

          streamTorrent_wosub(torrent);

        }

      });
    }

    function getSubtitles(torrent, torrent_title){

      opensubtitles.api.login()
      .done(function(token){
        opensubtitles.api.search(token, subtitle_language, torrent_title)
        .done(
          function(results){
            if (typeof results[0] != "undefined") {
              console.log(chalk.green.bold("Subtitle found!"));
              console.log(chalk.green.bold("Downloading..."));

              //download file
              var url = results[0].SubDownloadLink.split('.gz').join('.srt');
              var dest = os.tmpdir() + "/sub.srt";
              var cb;

              var download = function(url, dest, cb) {
                var file = fs.createWriteStream(dest);
                var request = http.get(url, function(response) {
                  response.pipe(file);
                  file.on('finish', function() {
                    file.close(cb);
                    console.log(chalk.green.bold("Subtitle downloaded."));
                    peerflix_subtitle = dest;
                    streamTorrent_sub(torrent);
                  });
                });
              };

              download(url, dest, cb);

            } else {
              console.log(chalk.red.bold("no subtitles found :( Sorry."));
              console.log(chalk.red.bold("Streaming without subtitles."));
              streamTorrent_wosub(torrent);
            }
          }
        );
      });


    }

    function streamTorrent_wosub(torrent){
      spawn(peerflix_command, [torrent, peerflix_player, peerflix_player_arg, peerflix_port], {
        stdio: 'inherit'
      });
    }

    function streamTorrent_sub(torrent){
      spawn(peerflix_command, [torrent, "--subtitles=\"" + peerflix_subtitle + "\"", peerflix_player, peerflix_player_arg, peerflix_port], {
        stdio: 'inherit'
      });
    }

}).call(this);
