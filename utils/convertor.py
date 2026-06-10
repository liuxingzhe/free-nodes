# -*- coding: utf-8 -*-
"""
@license: Apache-2.0
@description: 订阅转换模块：负责将清洗干净的 Top 优质节点渲染、注入到 Clash YAML 与 Sing-box JSON 模板中，
               及生成常规 Base64 订阅文本分发。
"""

import base64
import json
import os
from typing import List, Dict
from jinja2 import Environment, FileSystemLoader

class Convertor:
    """
    配置渲染与分发转换引擎
    """
    def __init__(self, clash_template_path: str, singbox_template_path: str):
        self.clash_tpl_path = clash_template_path
        self.singbox_tpl_path = singbox_template_path

    def to_base64_sub(self, nodes: List[Dict]) -> str:
        """
        转换为常规 Base64 换行符拼接节点形式类型
        """
        raw_urls = [node["raw"] for node in nodes]
        raw_text = "\n".join(raw_urls)
        # 编码为标准 Base64 文本
        encoded_bytes = base64.b64encode(raw_text.encode('utf-8'))
        return encoded_bytes.decode('utf-8')

    def to_clash_proxies(self, nodes: List[Dict]) -> List[Dict]:
        """
        将节点字典转化为 Clash 配置文件所需的规范 proxies 数组格式
        """
        clash_proxies = []
        for index, node in enumerate(nodes):
            name = node["name"].replace(":", "-").replace("[", "").replace("]", "")
            # 保证节点名称唯一
            unique_name = f"🚀 {name} | {node['protocol'].upper()}_{index+1}"
            
            p = {
                "name": unique_name,
                "type": node["protocol"],
                "server": node["server"],
                "port": node["port"],
            }

            # 协议细节注入
            protocol = node["protocol"]
            params = node.get("params", {})
            uuid = node.get("uuid", "")

            if protocol == "vmess":
                p["uuid"] = node.get("uuid") or params.get("id", "")
                p["alterId"] = int(params.get("aid", 0))
                p["cipher"] = params.get("scy", "auto")
                p["tls"] = True if params.get("tls") in ["tls", True, "1"] else False
                p["network"] = params.get("net", "tcp")
                if p["network"] == "ws":
                    p["ws-opts"] = {
                        "path": params.get("path", "/"),
                        "headers": {
                            "Host": params.get("host", "")
                        }
                    }
                if params.get("sni"):
                    p["servername"] = params.get("sni")

            elif protocol == "vless":
                p["uuid"] = uuid
                p["cipher"] = "auto"
                p["tls"] = True if params.get("security") in ["tls", "xtls"] or params.get("tls") == "1" else False
                p["network"] = params.get("type", "tcp")
                if params.get("sni"):
                    p["servername"] = params.get("sni")
                if params.get("flow"):
                    p["flow"] = params.get("flow")
                if p["network"] == "ws":
                    p["ws-opts"] = {
                        "path": params.get("path", "/"),
                        "headers": {
                            "Host": params.get("host", "")
                        }
                    }

            elif protocol == "trojan":
                p["password"] = uuid
                p["sni"] = params.get("sni", "")
                p["udp"] = True

            elif protocol == "ss":
                # SS 主凭证包含 method:password 格式，有些是用 @ 之前的做 base64 或者是明文
                if ":" in uuid:
                    parts = uuid.split(":", 1)
                    p["cipher"] = parts[0]
                    p["password"] = parts[1]
                else:
                    # 容错：有些是 md5/base64 自带的
                    p["cipher"] = "aes-256-gcm"
                    p["password"] = uuid
                p["udp"] = True

            elif protocol in ["hysteria2", "hy2"]:
                p["type"] = "hysteria2"
                p["password"] = uuid
                p["sni"] = params.get("sni", node["server"])
                if params.get("obfs"):
                    p["obfs"] = params.get("obfs")
                    p["obfs-password"] = params.get("obfs-password", "")

            else:
                # 暂时兜底采用 Shadowsocks 映射
                p["type"] = "ss"
                p["cipher"] = "aes-128-gcm"
                p["password"] = uuid or "password"

            clash_proxies.append(p)
        return clash_proxies

    def generate_clash_yaml(self, clash_proxies: List[Dict], group_name: str = "AutoProxy") -> str:
        """
        读取模板，使用 Jinja2 渲染并注入生成的 Clash Proxies
        """
        try:
            # 安全检查模板是否存在，不存在的话则启用极简硬编码兜底配置
            if not os.path.exists(self.clash_tpl_path):
                return self._hardcoded_clash_fallback(clash_proxies, group_name)

            tpl_dir = os.path.dirname(self.clash_tpl_path) or "."
            tpl_file = os.path.basename(self.clash_tpl_path)
            
            env = Environment(loader=FileSystemLoader(tpl_dir))
            template = env.get_template(tpl_file)
            
            # 获取代理名称集合
            proxy_names = [p["name"] for p in clash_proxies]
            
            rendered = template.render(
                proxies=clash_proxies,
                proxy_names=proxy_names,
                group_name=group_name
            )
            return rendered
        except Exception as e:
            print(f"[Convertor] 渲染 Clash 模板遭遇错误 (降级为硬编码默认输出): {e}")
            return self._hardcoded_clash_fallback(clash_proxies, group_name)

    def generate_singbox_json(self, nodes: List[Dict]) -> str:
        """
        转换并输出到 Sing-box 配置中
        """
        try:
            # 建立 outbounds 节点列表
            outbounds = []
            
            for index, node in enumerate(nodes):
                name = node["name"].replace(":", "-")
                unique_name = f"🚀 {name} | {node['protocol'].upper()}_{index+1}"
                
                protocol = node["protocol"]
                params = node.get("params", {})
                uuid = node.get("uuid", "")

                outbound = {
                    "tag": unique_name,
                    "type": "selector" if protocol == "selector" else protocol,
                    "server": node["server"],
                    "server_port": node["port"]
                }

                # 各种协议转换 mapping 为 sing-box 1.18+ 标准
                if protocol == "vmess":
                    outbound["type"] = "vmess"
                    outbound["uuid"] = uuid
                    outbound["security"] = params.get("scy", "auto")
                    outbound["alter_id"] = int(params.get("aid", 0))
                    transport_type = params.get("net", "tcp")
                    if transport_type in ["ws", "grpc"]:
                        outbound["transport"] = {
                            "type": transport_type,
                            "path": params.get("path", "/"),
                            "headers": {"Host": params.get("host", "")}
                        }
                    if params.get("tls") in ["tls", "1"]:
                        outbound["tls"] = {
                            "enabled": True,
                            "server_name": params.get("sni", node["server"])
                        }

                elif protocol == "vless":
                    outbound["type"] = "vless"
                    outbound["uuid"] = uuid
                    outbound["flow"] = params.get("flow", "")
                    if params.get("security") in ["tls", "xtls"] or params.get("tls") == "1":
                        outbound["tls"] = {
                            "enabled": True,
                            "server_name": params.get("sni", node["server"])
                        }
                    transport_type = params.get("type", "tcp")
                    if transport_type in ["ws", "grpc"]:
                        outbound["transport"] = {
                            "type": transport_type,
                            "path": params.get("path", "/"),
                            "headers": {"Host": params.get("host", "")}
                        }

                elif protocol == "trojan":
                    outbound["type"] = "trojan"
                    outbound["password"] = uuid
                    outbound["tls"] = {
                        "enabled": True,
                        "server_name": params.get("sni", node["server"])
                    }

                elif protocol == "ss":
                    outbound["type"] = "shadowsocks"
                    if ":" in uuid:
                        parts = uuid.split(":", 1)
                        outbound["method"] = parts[0]
                        outbound["password"] = parts[1]
                    else:
                        outbound["method"] = "aes-256-gcm"
                        outbound["password"] = uuid

                elif protocol in ["hysteria2", "hy2"]:
                    outbound["type"] = "hysteria" # or hysteria2 depending on version
                    outbound["password"] = uuid
                    outbound["tls"] = {
                        "enabled": True,
                        "server_name": params.get("sni", node["server"])
                    }
                else:
                    # 默认兜底
                    continue

                outbounds.append(outbound)

            # 读取 Sing-box 模板注入
            if os.path.exists(self.singbox_tpl_path):
                with open(self.singbox_tpl_path, "r", encoding="utf-8") as f:
                    config_data = json.load(f)
            else:
                config_data = {
                    "log": {"level": "info"},
                    "dns": {"servers": [{"tag": "dns_direct", "address": "8.8.8.8"}]},
                    "outbounds": [
                        {"type": "direct", "tag": "direct"},
                        {"type": "block", "tag": "block"}
                    ]
                }

            # 插入外发的代理节点列表并放置于 selector 模型前端
            if "outbounds" not in config_data:
                config_data["outbounds"] = []

            # 如果模板有一个 main/proxy selector，我们将节点的名字全推进其 outbounds 里
            for item in config_data["outbounds"]:
                if item.get("type") == "selector" and item.get("tag") == "Select":
                    item["outbounds"] = [ob["tag"] for ob in outbounds] + ["direct"]

            # 追加定义的所有具体节点 outbound
            config_data["outbounds"].extend(outbounds)

            return json.dumps(config_data, indent=2, ensure_ascii=False)
        except Exception as e:
            print(f"[Convertor] 编译 Sing-box 失败，错误: {e}")
            return json.dumps({"error": str(e)}, indent=2)

    def _hardcoded_clash_fallback(self, proxies: List[Dict], group_name: str) -> str:
        """
        极简 Clash 配置文件硬编码保底机制
        """
        proxy_names_str = "\n".join([f"      - \"{p['name']}\"" for p in proxies])
        
        proxies_yaml_list = []
        for p in proxies:
            # 拼装单个 Proxy YAML
            lines = [
                f"  - name: \"{p['name']}\"",
                f"    type: {p['type']}",
                f"    server: {p['server']}",
                f"    port: {p['port']}"
            ]
            if "uuid" in p: lines.append(f"    uuid: {p['uuid']}")
            if "password" in p: lines.append(f"    password: {p['password']}")
            if "cipher" in p: lines.append(f"    cipher: {p['cipher']}")
            if "alterId" in p: lines.append(f"    alterId: {p['alterId']}")
            if "tls" in p: lines.append(f"    tls: {'true' if p['tls'] else 'false'}")
            if "servername" in p: lines.append(f"    servername: {p['servername']}")
            if "network" in p: lines.append(f"    network: {p['network']}")
            if "ws-opts" in p:
                lines.append("    ws-opts:")
                lines.append(f"      path: {p['ws-opts'].get('path', '/')}")
                if p['ws-opts'].get('headers'):
                    lines.append("      headers:")
                    lines.append(f"        Host: {p['ws-opts']['headers'].get('Host', '')}")
            proxies_yaml_list.append("\n".join(lines))
            
        proxies_str = "\n".join(proxies_yaml_list)

        return f"""port: 7890
socks-port: 7891
allow-lan: true
mode: Rule
log-level: info
external-controller: 127.0.0.1:9090

proxies:
{proxies_str}

proxy-groups:
  - name: {group_name}
    type: select
    proxies:
      - AUTO_FASTEST
{proxy_names_str}
      - direct

  - name: AUTO_FASTEST
    type: url-test
    url: http://cp.cloudflare.com/generate_204
    interval: 300
    tolerance: 50
    proxies:
{proxy_names_str}

rules:
  - DOMAIN-SUFFIX,google.com,AutoProxy
  - DOMAIN-keyword,github,AutoProxy
  - GEOIP,CN,DIRECT
  - MATCH,AutoProxy
"""
