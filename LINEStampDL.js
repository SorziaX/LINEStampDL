var request = require('request');
var cheerio = require('cheerio');
var https = require('https');
var fs = require('fs');
var css =require('css');
var url = require("url");
var slog = require('single-line-log').stdout;

const animation_url_template = "https://stickershop.line-scdn.net/stickershop/v1/sticker/[code]/IOS/sticker_animation@2x.png;compress=true"
const image_url_template = "https://stickershop.line-scdn.net/stickershop/v1/sticker/[code]/IOS/sticker@2x.png;compress=true"

//get args
var args = process.argv.splice(2)
if(args.length != 2){
    endWithError('please input arguments correctly');
    return;
}
var dirName = args[0];
var htmlUrl = args[1];
 
//init output
var needed = 0;
var finished = 0;
var pb = new ProgressBar('Progress', 40);
pb.render({ completed: 0, total: 2 });

//get the html
var opt = url.parse(htmlUrl);
var html;
https.get(opt, function(res) {
    res.setEncoding('utf-8');
    res.on('data', function(chunk) {
        html += chunk;
    });

    res.on('end', function() {

        pb.render({ completed: 1, total: 2 });

        if(!fs.existsSync(dirName)){
            fs.mkdirSync(dirName);
        }

        var thumbURLs = thumbURLsFromLINEStoreHTML(html);
        for (const index in thumbURLs) {
            if (thumbURLs.hasOwnProperty(index)) {
                const thumbURL = thumbURLs[index];
                downloadImageFromThumbURL(thumbURL);
            }
        }
    });
}).on('error', function(err) {
    endWithError("can't access to the given url");
});

function downloadImageFromThumbURL(thumbURL){

    var code = lineStampCodeFromThumbURL(thumbURL);
    var url = urlFromCodeTemplate(code , animation_url_template);

    setTimeout(function(){
        downloadImageFile(url, dirName + "/" + code + ".png",function(){
            url = urlFromCodeTemplate(code , image_url_template);
            downloadImageFile(url, dirName + "/" + code + ".png");
        });
    },500 * needed);

    needed++;
} 

function thumbURLsFromLINEStoreHTML(html){
    var urls = [];
    var $ = cheerio.load(html);
    var spans = $('span[class=mdCMN09Image]');
    spans.each(function(index, elem) {
        var style = $(this).attr("style");
        var object = css.parse("span{"+style+"}");

        object.stylesheet.rules[0].declarations.forEach(function(item,i,array){
            if(item.property == 'background-image'){
                var thumbURL = item.value.slice(4,item.value.length - 1);
                urls.push(thumbURL);
            }
        });
    });

    return urls;
}

function urlFromCodeTemplate(code,template){
    var url = "";
    var comps = template.split("[code]");
    url = comps[0] + code + comps[1];
    return url;
}

function lineStampCodeFromThumbURL(thumbURL){
    var req = url.parse(thumbURL);
    var code = req.pathname.split('/')[4];
    return code;
}

function downloadImageFile(url,filename,notFound){
    /*
    var img_src = url;
    request.head(img_src,function(err,res,body){
        if(err){
            console.log("failed:" + img_src);
        }
    });
     
    var img_filename = filename;  
    request(img_src).pipe(fs.createWriteStream('./'+ img_filename));
    */

    https.get(url, function(res) {
        var data = '';

        res.setEncoding('binary');

        res.on('data', function(chunk) {
            data += chunk;
        });

        res.on('end', function() {

            if(data.indexOf("404 Not Found") > -1){
                notFound ? notFound() : null;
            }else{
                fs.writeFile(filename, data, 'binary', function(err) {
                    if (err) {
                        return console.log(err);
                    }else{
                        finished++;
                        pb.render({ completed: finished, total: needed });
                    }
                });
            }
        });
    }).on('error', function(err) {
        setTimeout(function(){
            downloadImageFile(url,filename,notFound);
        },1000)
    });
}

function endWithError(error){
    console.log('failed with error : ' + error);
}

function ProgressBar(description, bar_length){

    this.description = description || 'Progress';
    this.length = bar_length || 25;
    
    this.render = function (opts){
    var percent = (opts.completed / opts.total).toFixed(4);
    var cell_num = Math.floor(percent * this.length);
    
    var cell = '';
    for (var i=0;i<cell_num;i++) {
        cell += '█';
    }
    
    var empty = '';
    for (var i=0;i<this.length-cell_num;i++) {
        empty += '░';
    }
    
    var cmdText = this.description + ': ' + (100*percent).toFixed(2) + '% ' + cell + empty + ' ' + opts.completed + '/' + opts.total;
        slog(cmdText + '\n');
    };
}