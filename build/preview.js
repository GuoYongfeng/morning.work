/**
 * preview morning.work
 *
 * @author Zongmin Lei <leizongmin@gmail.com>
 */

import path from 'path';
import fs from 'fs';
import express from 'express';
import serveStatic from 'serve-static';
import open from 'open';
import {renderPost, renderPostList} from './index';

let app = express();
app.get('/', (req, res, next) => {
  renderPostList(false, next);
});
app.get('/page/*.html', (req, res, next) => {
  let f = path.resolve(__dirname, `../source/${req.params[0]}.md`);
  renderPost(f, next);
});

app.use('/', serveStatic(path.resolve(__dirname, '..')));

app.listen(8000, err => {
  if (err) throw err;
  console.log('server started');
  open('http://127.0.0.1:8000');
});
