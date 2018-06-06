'use strict';

module.exports = (pluginContext) => {
  const pluginName = 'puttytray';
  const shell = pluginContext.shell;
  const logger = pluginContext.logger;
  const localStorage  = pluginContext.localStorage ;
  const preferences = pluginContext.preferences;

  const exec = require('child_process').exec;
  const fs = require('fs');
  const Fuse = require('fuse.js');

  // preferences
  let puttyTrayDirectory;
  let lastSelectedLimit;

  let storedSessions = [];
  let lastSelected = localStorage.getItem('lastSelected') || [];
  let isError = false;
  let fuse;

  function onPrefsUpdate(prefs){
    puttyTrayDirectory = prefs.puttyTrayDirectory;
    lastSelectedLimit = prefs.lastSelectedLimit;
    loadPuttyTraySessions();
  }

  function loadPuttyTraySessions() {
    logger.log('loading Putty sessions...');
    let sessionsDirectory = puttyTrayDirectory + '\\Sessions';

    if(!puttyTrayDirectory){
      storedSessions = ['Please, define path to PuTTYtray directory'];
      isError = true;
      return false;
    }
    if(!fs.existsSync(sessionsDirectory)){
      storedSessions = [sessionsDirectory + ' not exists'];
      isError = true;
      return false;
    }

    storedSessions = fs.readdirSync(sessionsDirectory)
      .map(file => decodeURI(file)) // %20 to space
      .filter(name => name != 'WinSCP temporary session')
      .filter(name => name != 'Default Settings')

    storedSessions.sort();

    let storedSessionsObjects = storedSessions.map(name => {
      return { name };
    });
    // logger.log('storedSessionsObjects', storedSessionsObjects);
    fuse = new Fuse(storedSessionsObjects, {
      keys: ['name'],
      threshold: 0.3,
      location: 4,
    });

    logger.log('putty sessions: ', storedSessions);
    isError = false;
  }

  function startup() {
    onPrefsUpdate(preferences.get());
    loadPuttyTraySessions();
    preferences.on('update', onPrefsUpdate);
  }

  function search(query, res) {
    query = query.trim();
    const isQuery = query.length > 0;

    // MRU
    if(!isQuery && lastSelected.length > 0){
      // logger.log(lastSelected);
      lastSelected.forEach(session => {
        res.add({
          id: 'session',
          title: session,
          payload: session,
          icon: '#fa fa-chevron-right'
        });
      });

      // divider
      res.add({
        id: '',
        title: '-----------------------',
        payload: '',
        icon: '#fa '
      });
    }

    // filter
    /* const sessions = [].concat(
      lastSelected,
      storedSessions.filter(session => lastSelected.indexOf(session) == -1)
    );
    const filtered = sessions.filter(session => session.toLowerCase().search(query) >= 0);
    logger.log('filtered', sessions); */
    const filteredLast = lastSelected.filter(session => session.toLowerCase().search(query) >= 0);
    const found = fuse.search(query).map(item => { return item.name });
    logger.log('found', found);
    const filtered = filteredLast.concat(found);
    logger.log('filtered', filteredLast.concat(found));

    // add results
    filtered.forEach(session => {
      res.add({
        id: isError ? 'prefs' : 'session',
        title: session,
        payload: session,
        icon: '#fa fa-' + (isError ? 'exclamation' : 'chevron-right')
      });
    });

    // add putty "query"
    if(filtered.length == 0 && isQuery){
      res.add({
        id: 'q',
        title: isQuery ? 'putty.exe ' + query  : query,
        payload: query,
        icon: '#fa fa-chevron-right'
      });
    }

    // add reload
    res.add({
      id: 'reload',
      title: 'reload',
      desc: 'reload putty sessions',
      icon: '#fa fa-cog'
    });

    // add prefs
    res.add({
      id: 'prefs',
      title: 'preferences',
      desc: 'open plugin preferences',
      icon: '#fa fa-cog'
    });
  }

  function updateLastSelected(payload){
    const limit = parseInt(lastSelectedLimit);

    if(!payload){
      return;
    }

    lastSelected = lastSelected
      .filter(session => session != payload) // remove duplicate
      .filter(session => storedSessions.indexOf(session) != -1) // remove old values

    lastSelected.unshift(payload) // add new session
    lastSelected = lastSelected.slice(0, limit) // limit
    localStorage.setItem('lastSelected', lastSelected);
  }

  function execute(id, payload) {
    switch (id) {
      case 'q':
        if (payload.trim().length > 0) {
          exec(`START ${puttyTrayDirectory}\\putty.exe ${payload}`);
        }
      break;

      case 'session':
        updateLastSelected(payload);
        logger.log(`START ${puttyTrayDirectory}\\putty.exe "${payload}"`);
        exec(`START ${puttyTrayDirectory}\\putty.exe -load "${payload}"`);
      break;

      case 'reload':
        loadPuttyTraySessions();
      break;

      case 'prefs':
        pluginContext.app.openPreferences('hain-plugin-' + pluginName);
      break;
    }
  }

  return { startup, search, execute };
};