function processNetworks(data) {
    let networks = data.config.networks.network;

    if (!Array.isArray(networks)) {
        networks = [networks];
    }

    let devices = [];

    networks.forEach((network) => {

        if (!Array.isArray(network.node)) {
            network.node = [network.node];
        }

        network.node.forEach((node) => {
            devices.push({ 'id': node['node-id'], 
                'user': node['netconf-connect-params']['user'], 
                'server': node['netconf-connect-params']['server'], 
                'password': node['netconf-connect-params']['password'], 
                'port': node['netconf-connect-params']['ncport'] 
            });
        });
    });

    return devices;
}

module.exports = processNetworks