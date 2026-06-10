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

def detect_country_by_name(name: str) -> str:
    """
    通过节点名称中的关键字，智能匹配出国家/地区代码（HK, JP, SG, US, CN, TW, KR, GB, DE 等）
    """
    name_lower = name.lower()
    if any(k in name_lower for k in ["hk", "hongkong", "hong kong", "香港", "港", "hkg"]):
        return "HK"
    if any(k in name_lower for k in ["jp", "japan", "tokyo", "日本", "川", "东京", "nrt", "kix"]):
        return "JP"
    if any(k in name_lower for k in ["sg", "singapore", "新加坡", "新", "sin"]):
        return "SG"
    if any(k in name_lower for k in ["us", "usa", "united states", "america", "美国", "美", "la", "ny", "sfo"]):
        return "US"
    if any(k in name_lower for k in ["cn", "china", "domestic", "中国", "中", "陆", "北京", "上海", "深圳", "广州"]):
        return "CN"
    if any(k in name_lower for k in ["tw", "taiwan", "台湾", "台", "台北", "tpe"]):
        return "TW"
    if any(k in name_lower for k in ["kr", "korea", "seoul", "韩国", "韩", "icn"]):
        return "KR"
    if any(k in name_lower for k in ["gb", "uk", "united kingdom", "london", "英国", "英", "lhr"]):
        return "GB"
    if any(k in name_lower for k in ["de", "germany", "frankfurt", "德国", "德", "fra"]):
        return "DE"
    return "UN"

def parse_node(url: str) -> Optional[Dict]:
    res = _parse_node_raw(url)
    if res:
        res["country"] = detect_country_by_name(res.get("name", ""))
    return res

def _parse_node_raw(url: str) -> Optional[Dict]:
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
            # VMess 采用 base64 编码 of JSON 字符串配置
            raw_b64 = url[8:]
            # 兼容有些客户端在 vmess:// base64 串后面附带 #备注 的非标格式
            vmess_name_extracted = ""
            if "#" in raw_b64:
                raw_b64, vmess_name_extracted = raw_b64.split("#", 1)
                vmess_name_extracted = unquote(vmess_name_extracted)
            if "?" in raw_b64:
                raw_b64, _ = raw_b64.split("?", 1)
                
            decoded_json = safe_b64decode(raw_b64)
            if not decoded_json:
                return None
            try:
                data = json.loads(decoded_json)
                server = data.get("add", "")
                port_raw = data.get("port", 0)
                try:
                    port = int(port_raw)
                except ValueError:
                    port = 0
                uuid = data.get("id", "")
                
                # 读取命名备注
                name = unquote(data.get("ps", "VMess Node"))
                if (not name or name == "VMess Node") and vmess_name_extracted:
                    name = vmess_name_extracted
                
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
                pass

        # 针对通用 URL-like 协议: vless://, ss://, ssr://, trojan://, hysteria2://, hy2://, tuic://
        protocol = ""
        if "://" in url:
            protocol, rest = url.split("://", 1)
            protocol = protocol.lower()
        else:
            return None
            
        if protocol in ["vless", "trojan", "ss", "ssr", "hysteria2", "hy2", "tuic"]:
            # 特殊解密处理 ss:// 全包 base64
            if protocol == "ss" and "@" not in rest:
                payload = rest
                fragment = ""
                if "#" in payload:
                    payload, fragment = payload.split("#", 1)
                decoded = safe_b64decode(payload)
                if "@" in decoded:
                    try:
                        cred, host_port = decoded.rsplit("@", 1)
                        if ":" in host_port:
                            server, port_str = host_port.split(":", 1)
                            int_port = int(port_str)
                            name = unquote(fragment) if fragment else f"SS_{server}_{int_port}"
                            return {
                                "protocol": "ss",
                                "server": server,
                                "port": int_port,
                                "uuid": cred,
                                "name": name,
                                "raw": url,
                                "params": {}
                            }
                    except Exception:
                        pass

            # 特殊解密处理 ssr:// 全包 base64
            if protocol == "ssr":
                payload = rest
                if "#" in payload:
                    payload, _ = payload.split("#", 1)
                decoded = safe_b64decode(payload)
                if decoded:
                    parts = decoded.split(":")
                    if len(parts) >= 6:
                        try:
                            server = parts[0]
                            int_port = int(parts[1])
                            ssr_proto = parts[2]
                            method = parts[3]
                            obfs = parts[4]
                            pass_b64 = parts[5]
                            name = f"SSR_{server}_{int_port}"
                            if "/" in pass_b64:
                                pass_part, query_part = pass_b64.split("/", 1)
                                if query_part.startswith("?"):
                                    query_part = query_part[1:]
                                queries = parse_qs(query_part)
                                if "remarks" in queries:
                                    name = safe_b64decode(queries["remarks"][0])
                            return {
                                "protocol": "ssr",
                                "server": server,
                                "port": int_port,
                                "uuid": pass_b64,
                                "name": name,
                                "raw": url,
                                "params": {"ssr_protocol": ssr_proto, "method": method, "obfs": obfs}
                            }
                        except Exception:
                            pass

            # ================= 坚如磐石的单轨切分 =================
            # 1. 拆出备注 fragment
            fragment = ""
            if "#" in rest:
                rest, fragment = rest.split("#", 1)
            name = unquote(fragment) if fragment else ""
            
            # 2. 扣除查询参数
            query_str = ""
            if "?" in rest:
                rest, query_str = rest.split("?", 1)
            queries = parse_qs(query_str)
            params = {k: v[0] for k, v in queries.items()}

            # 3. 抓取登陆信息 (user_info) 跟主机
            user_info = ""
            if "@" in rest:
                # 倒序查找，免除 uuid/密码中的 @ 字符干扰
                user_info, rest = rest.rsplit("@", 1)
            
            # 4. 解析服务器和端口 (支持 IPv6 [xxxx:xxxx::1]:port 和 常规 ipv4/host:port)
            server = rest
            port = 0
            if rest.startswith("[") and "]:" in rest:
                server_part, port_str = rest.split("]:", 1)
                server = server_part + "]"
                try:
                    port = int(port_str)
                except ValueError:
                    pass
            elif ":" in rest:
                server_part, port_str = rest.rsplit(":", 1)
                server = server_part
                try:
                    port = int(port_str)
                except ValueError:
                    pass

            if not server or not port:
                # 人工解析出现任何不规则漏气，自动回退到 urlparse 进行保底兼容
                try:
                    parsed = urlparse(url)
                    server = parsed.hostname or ""
                    port = parsed.port or 0
                except Exception:
                    pass

            if not server or not port:
                return None

            # 若上面切割没找到 name 备注，拟定默认高频命名
            if not name:
                name = f"{protocol.upper()}_{server}_{port}"

            return {
                "protocol": protocol,
                "server": server,
                "port": int(port),
                "uuid": user_info,
                "name": name,
                "raw": url,
                "params": params
            }

    except Exception:
        return None
    return None

def get_node_hash(node: Dict) -> str:
    """
    哈希生成模块：基于服务器地址+端口+主要密钥凭证生成 MD5
    不包含名称参数，从而实现因备注不同但实际是同一节点的完美去重
    """
    key = f"{node['protocol']}_{node['server']}_{node['port']}_{node['uuid']}"
    return hashlib.md5(key.encode('utf-8')).hexdigest()

def clash_proxy_to_uri(p: Dict) -> Optional[str]:
    """
    把 Clash 字典转换回标准的客户端协议连接 URI 格式
    """
    try:
        ptype = str(p.get("type", "")).lower()
        server = p.get("server")
        port = p.get("port")
        name = p.get("name", "Node")
        if not server or not port:
            return None
        
        hash_part = f"#{name}"

        if ptype in ["ss", "shadowsocks"]:
            cipher = p.get("cipher") or p.get("cipher_type")
            password = p.get("password")
            if cipher and password:
                credential = base64.b64encode(f"{cipher}:{password}".encode()).decode()
                return f"ss://{credential}@{server}:{port}{hash_part}"
        
        elif ptype == "trojan":
            password = p.get("password")
            if password:
                return f"trojan://{password}@{server}:{port}{hash_part}"
        
        elif ptype == "vmess":
            uuid = p.get("uuid")
            if uuid:
                v_meta = {
                    "v": "2",
                    "ps": name,
                    "add": server,
                    "port": str(port),
                    "id": uuid,
                    "aid": "0",
                    "net": p.get("network", "tcp"),
                    "type": "none",
                    "host": p.get("ws-opts", {}).get("headers", {}).get("Host") or p.get("servername", ""),
                    "path": p.get("ws-opts", {}).get("path", "/"),
                    "tls": "tls" if p.get("tls") else ""
                }
                b64_json = base64.b64encode(json.dumps(v_meta).encode()).decode()
                return f"vmess://{b64_json}"
        
        elif ptype == "vless":
            uuid = p.get("uuid")
            if uuid:
                tls = "security=tls" if p.get("tls") else ""
                return f"vless://{uuid}@{server}:{port}?{tls}{hash_part}"
        
        elif ptype in ["hysteria2", "hy2"]:
            password = p.get("password") or p.get("auth") or p.get("auth_str")
            if password:
                return f"hysteria2://{password}@{server}:{port}{hash_part}"

    except Exception:
        pass
    return None
