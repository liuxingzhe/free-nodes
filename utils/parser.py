# -*- coding: utf-8 -*-
"""
@license: Apache-2.0
@description: 各种节点协议(VMess, VLESS, Trojan, SS, Hysteria2)的解析器，提供哈希算法实现精确去重。
"""

import json
import base64
import hashlib
from urllib.parse import urlparse, parse_qs, unquote
from typing import Dict, Optional

def safe_b64decode(s: str) -> str:
    """
    鲁棒的 Base64 解码，解决丢失等号或空白符问题
    """
    s = s.strip().replace("\n", "").replace("\r", "").replace(" ", "")
    missing_padding = len(s) % 4
    if missing_padding:
        s += '=' * (4 - missing_padding)
    try:
        return base64.b64decode(s, validate=False).decode('utf-8', errors='ignore')
    except Exception:
        return ""

def parse_node(url: str) -> Optional[Dict]:
    """
    核心解析引擎：提取多协议节点细节（vmess, vless, ss, trojan, hysteria2, hy2）
    返回规范化的字典：
    {
        "protocol": "vless",
        "server": "1.2.3.4",
        "port": 443,
        "uuid": "xxx",
        "name": "Japan Node",
        "raw": "vless://xxx...",
        "params": {...}
    }
    """
    url = url.strip()
    if not url:
        return None

    try:
        if url.startswith("vmess://"):
            # VMess 采用 base64 编码的 JSON 字符串配置
            raw_b64 = url[8:]
            decoded_json = safe_b64decode(raw_b64)
            if not decoded_json:
                return None
            try:
                data = json.loads(decoded_json)
                # 兼容不同生成器产生的字段词书（如 add / port / id / ps）
                server = data.get("add", "")
                port = int(data.get("port", 0))
                uuid = data.get("id", "")
                name = unquote(data.get("ps", "VMess Node"))
                
                # 过滤不完整配置
                if not server or not port:
                    return None
                
                return {
                    "protocol": "vmess",
                    "server": server,
                    "port": port,
                    "uuid": uuid,
                    "name": name,
                    "raw": url,
                    "params": data
                }
            except Exception:
                # 容错：有些 VMess 是 URI 格式 (类似 vless://)
                pass

        # 针对 URL-like 协议: vless://, ss://, trojan://, hysteria2://, hy2://
        parsed = urlparse(url)
        protocol = parsed.scheme.lower()
        
        if protocol in ["vless", "trojan", "ss", "ssr", "hysteria2", "hy2", "tuic"]:
            server = parsed.hostname
            port = parsed.port
            if not server or not port:
                return None

            # 提取名称 Remarks (即 URL 中的 fragment # 后面的部分)
            name = unquote(parsed.fragment) if parsed.fragment else f"{protocol.upper()}_{server}_{port}"
            # 提取连接主凭证
            user_info = unquote(parsed.username) if parsed.username else ""
            if not user_info and parsed.netloc and "@" in parsed.netloc:
                user_info = parsed.netloc.split("@")[0]
            
            # 收集查询参数
            queries = parse_qs(parsed.query)
            params = {k: v[0] for k, v in queries.items()}

            return {
                "protocol": protocol,
                "server": server,
                "port": int(port),
                "uuid": user_info,  # 对于 SS 是 method:password 的 base64，Trojan/VLESS 是 UUID / 密码
                "name": name,
                "raw": url,
                "params": params
            }

    except Exception:
        # 异常跳过，防止单个不合规范节点崩溃整个主程序
        return None
    return None

def get_node_hash(node: Dict) -> str:
    """
    哈希生成模块：基于服务器地址+端口+主要密钥凭证生成 MD5
    不包含名称参数，从而实现因备注不同但实际是同一节点的完美去重
    """
    key = f"{node['protocol']}_{node['server']}_{node['port']}_{node['uuid']}"
    return hashlib.md5(key.encode('utf-8')).hexdigest()
