import type { Agent } from 'https';
import { HttpsProxyAgent } from 'https-proxy-agent';
import { SocksProxyAgent } from 'socks-proxy-agent';

export function buildBaileysProxyAgent(
  proxy?: { url: string; type: 'http' | 'https' | 'socks4' | 'socks5' },
): Agent | undefined {
  if (!proxy?.url?.trim()) return undefined;
  const url = proxy.url.trim();
  if (proxy.type === 'socks4' || proxy.type === 'socks5') {
    const scheme = proxy.type === 'socks4' ? 'socks4' : 'socks5';
    const normalized = url.includes('://') ? url : `${scheme}://${url}`;
    return new SocksProxyAgent(normalized) as unknown as Agent;
  }
  const normalized = url.includes('://') ? url : `http://${url}`;
  return new HttpsProxyAgent(normalized) as unknown as Agent;
}
