'use strict';

const easyNetconfPromise = import('easynetconf').then(module => module.easyNetconf);

function easyNetconfCJS(server, port, username, password, privatekey_path = null, publickey_path = null) {
  if (!easyNetconfCJS.easyNetconfClass) {
    throw new Error('easyNetconf module not loaded yet. Make sure to await easyNetconfCJS.ready() before instantiating.');
  }
  
  return new easyNetconfCJS.easyNetconfClass(
    server, 
    port, 
    username, 
    password, 
    privatekey_path, 
    publickey_path
  );
}

easyNetconfPromise.then(EasyNetconfClass => {
  easyNetconfCJS.easyNetconfClass = EasyNetconfClass;
});

easyNetconfCJS.ready = function() {
  return easyNetconfPromise.then(() => {
    return true;
  });
};

module.exports = easyNetconfCJS;