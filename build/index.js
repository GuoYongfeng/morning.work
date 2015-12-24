/**
 * build morning.work
 *
 * @author Zongmin Lei <leizongmin@gmail.com>
 */

import path from 'path';
import fs from 'fs';
import rd from 'rd';
import mkdirp from 'mkdirp';
import tinyliquid from 'tinyliquid';
import MarkdownIt from 'markdown-it';
import RSS from 'rss';
import authors from './authors';

let md = new MarkdownIt({
  linkify: true,
  html: true,
  langPrefix: 'prettyprint ',
  typography: true
});
md.use(require('markdown-it-toc'));

let SOURCE_DIR = path.resolve(__dirname, '../source');
let TARGET_DIR = path.resolve(__dirname, '../page');
let TPL_LIST = tinyliquid.parse(fs.readFileSync(path.resolve(__dirname, 'tpl_list.html')).toString());
let TPL_ITEM = tinyliquid.parse(fs.readFileSync(path.resolve(__dirname, 'tpl_item.html')).toString());

let baseTplContext = tinyliquid.newContext();
baseTplContext.onInclude(function (filename, callback) {
  fs.readFile(path.resolve(__dirname, filename), {encoding: 'utf8'}, (err, data) => {
    var ast = null;
    try {
      ast = tinyliquid.parse(data.toString());
    } catch (err) {
      return callback(err);
    }
    callback(err, ast);
  });
});

function readFile(f) {
  let data = fs.readFileSync(f).toString().replace(/\r/g, '');
  data = formatContent(data);
  let i = data.indexOf('\n\n');
  let head, body;
  if (i === -1) {
    head = data;
    body = '';
  } else {
    head = data.slice(0, i);
    body = data.slice(i);
  }

  let info = {};
  head.split('\n').forEach(line => {
    let i = line.indexOf(':');
    if (i === -1) {
      info[line.trim()] = true;
    } else {
      info[line.slice(0, i).trim()] = line.slice(i + 1).trim();
    }
  });
  info.content = md.render(body);
  if (typeof info.date === 'string') {
    info.date = info.date.split(/\s+/).filter(v => /\d{2,4}\-\d{1,2}\-\d{1,2}/.test(v));
  }
  info.lastDate = info.date[info.date.length - 1];
  let url = f.slice(SOURCE_DIR.length);
  info.url = url.slice(0, -3) + '.html';

  info.authors = (info.author || '').trim().split(/\s/).map(name => {
    if (authors[name]) {
      return authors[name][info.language] || authors[name].default;
    } else {
      return {name: name, link: 'http://morning.work', about: name};
    }
  });

  return info;
}

function writeFile(f, d) {
  mkdirp.sync(path.dirname(f));
  fs.writeFileSync(f, d);
}

function firstItem(arr) {
  return arr[0];
}

function lastItem(arr) {
  return arr[arr.length - 1];
}

function formatContent(text) {
  return text.replace(/([^\x00-\xff]+)/g, ' $1 ');
}

/******************************************************************************/

function getPostList() {
  return rd.readFileFilterSync(SOURCE_DIR, /\.md$/).map((f, s) => {
    console.log('read file: %s', f);
    return readFile(f);
  }).sort((a, b) => {
    let ad = new Date(lastItem(a.date)).getTime();
    let bd = new Date(lastItem(b.date)).getTime();
    return bd - ad;
  }).filter(a => {
    return !a.draft && !a.hide;
  });
}

export function renderPostList(list, callback, tplList) {
  list = list || getPostList();
  tplList = tplList || tinyliquid.parse(fs.readFileSync(path.resolve(__dirname, 'tpl_list.html')).toString());
  let context = tinyliquid.newContext({locals: {list: list}});
  context.from(baseTplContext);
  tinyliquid.run(tplList, context, err => {
    if (err) return callback(err);

    let html = context.getBuffer();
    let f = path.resolve(TARGET_DIR, 'index.html');
    console.log('write to file: %s', f);
    writeFile(f, html);

    let f2 = path.resolve(__dirname, '../index.html');
    console.log('write to file: %s', f2);
    writeFile(f2, html);

    callback();
  });
}

export function renderPost(item, callback, tplItem) {
  if (typeof item === 'string') {
    item = readFile(item);
  }
  tplItem = tplItem || tinyliquid.parse(fs.readFileSync(path.resolve(__dirname, 'tpl_item.html')).toString());
  let context = tinyliquid.newContext({locals: item});
  context.from(baseTplContext);
  tinyliquid.run(tplItem, context, err => {
    if (!err) {
      item.html = context.getBuffer();
      let f = path.resolve(TARGET_DIR, item.url.slice(1));
      console.log('write to file: %s', f);
      writeFile(f, item.html);
    }
    callback(err);
  });
}

export function renderFeed(list, callback) {
  list = list || getPostList();

  var feed = new RSS({
    title: '早起搬砖 morning.work',
    feed_url: 'http://morning.work/rss.xml',
    site_url: 'http://morning.work',
    language: 'zh-CN,en',
    ttl: '60',
  });

  for (let item of list) {
    feed.item({
      title: item.title,
      description: item.content,
      url: 'http://morning.work/page' + item.url,
      author: item.author,
      date: item.lastDate,
    });
  }

  var xml = feed.xml();
  let f = path.resolve(__dirname, '../rss.xml');
  console.log('write to file: %s', f);
  writeFile(f, xml);

  callback(null);
}

/******************************************************************************/

async function startBuild() {
  let list = getPostList();

  console.log('================================================================================');
  list.forEach(item => console.log('%s to %s:\t%s', firstItem(item.date), lastItem(item.date), item.title));
  console.log('================================================================================');
  console.log('total %s', list.length);

  try {

    for (let item of list) {
      await new Promise((resolve, reject) => {
        renderPost(item, err => {
          err ? reject(err)
              : resolve();
        }, TPL_ITEM);
      });
    }

    await new Promise((resolve, reject) => {
      renderPostList(list, err => {
        err ? reject(err)
            : resolve();
      }, TPL_LIST);
    });

    await new Promise((resolve, reject) => {
      renderFeed(list, err => {
        err ? reject(err)
            : resolve();
      });
    });

  } catch (err) {
    throw err;
  }

  console.log('done');
}

if (!module.parent) {
  startBuild();
}
