from tempfile import NamedTemporaryFile
import bitcoin.rpc

# docker run --rm -it -p 8332:8332 --name=bitcoin ruimarinho/bitcoin-core   -printtoconsole   -regtest=1   -rpcallowip=0.0.0.0/0 -rpcport=8332 -rpcpassword=46sDGGFD2 -rpcuser=df2EDbbsD

conf_str = """
rpcuser=df2EDbbsD
rpcpassword=46sDGGFD2
rpcport=8332
rpchost=0.0.0.0
rpctimeout=10000000
"""


class Proxy(object):
    """Simple proxy class to bitcoin.rpc.Proxy to deal with timeouts"""
    def __init__(self, conf_str=conf_str):
        self._conf_file = NamedTemporaryFile(mode='w+t')
        self._conf_file.write(conf_str)
        self._conf_file.seek(0)

    def __getattr__(self, name):
        if name.startswith('_'):
            return getattr(self, name)

        proxy = bitcoin.rpc.Proxy(btc_conf_file=self._conf_file.name,
                                  timeout=3600)
        self._proxy = proxy  # DEBUG
        return getattr(proxy, name)

    def __del__(self):
        self._conf_file.close()
