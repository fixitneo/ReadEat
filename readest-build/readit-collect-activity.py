"""Read rEadiT activity from a local server mirror or WebDAV device directory.

Example:
 python readit-collect-activity.py /srv/books/reading-activity/v1/devices/* --output activity.json
 python readit-collect-activity.py https://server/root/reading-activity/v1/devices/DEVICE --output activity.json
For authenticated WebDAV set READIT_WEBDAV_USER and READIT_WEBDAV_PASSWORD in the environment.
Output is data for an external assistant. This script never executes book text or writes a wiki.
"""
import argparse,base64,datetime,hashlib,json,os,re,urllib.request
from pathlib import Path
from zoneinfo import ZoneInfo

def read(base,name):
 if base.startswith(('https://','http://')):
  url=base.rstrip('/')+'/'+name
  request=urllib.request.Request(url)
  user=os.environ.get('READIT_WEBDAV_USER')
  if user:
   if not url.startswith('https://'): raise ValueError('Use HTTPS for credentials')
   credentials=(user+':'+os.environ.get('READIT_WEBDAV_PASSWORD','')).encode()
   request.add_header('Authorization','Basic '+base64.b64encode(credentials).decode())
  with urllib.request.urlopen(request,timeout=30) as response:return response.read()
 root=Path(base).resolve();target=(root/name).resolve()
 if not target.is_relative_to(root):raise ValueError('Unsafe activity path')
 return target.read_bytes()

def collect(bases):
 merged={}
 for base in bases:
  manifest=json.loads(read(base,'manifest.json'))
  if manifest.get('schema')!='reading-activity-manifest/v1':raise ValueError('Unsupported manifest')
  filename=manifest.get('file','')
  if not re.fullmatch(r'generations/[0-9]+-[a-f0-9]{16}\.json',filename):raise ValueError('Unsafe generation path')
  raw=read(base,filename)
  if hashlib.sha256(raw).hexdigest()!=manifest['sha256']:raise ValueError('Activity SHA256 mismatch')
  snapshot=json.loads(raw)
  if snapshot.get('schema')!='reading-activity/v1' or snapshot.get('deviceId')!=manifest['deviceId']:raise ValueError('Activity identity mismatch')
  for record in snapshot['records']:
   key=record['id'];previous=merged.get(key)
   clock=(record['updatedAt'],bool(record.get('deletedAt')))
   if previous is None or clock>(previous['updatedAt'],bool(previous.get('deletedAt'))):merged[key]=record
 return sorted((r for r in merged.values() if not r.get('deletedAt')),key=lambda r:(r['updatedAt'],r['id']))

def main():
 parser=argparse.ArgumentParser(description=__doc__)
 parser.add_argument('devices',nargs='+');parser.add_argument('--output',required=True)
 parser.add_argument('--timezone',default='Asia/Seoul');parser.add_argument('--yesterday',action='store_true')
 args=parser.parse_args();records=collect(args.devices)
 if args.yesterday:
  timezone=ZoneInfo(args.timezone);date=datetime.datetime.now(timezone).date()-datetime.timedelta(days=1)
  records=[r for r in records if datetime.datetime.fromtimestamp(r['updatedAt']/1000,timezone).date()==date]
 Path(args.output).write_text(json.dumps({'schema':'reading-activity-collection/v1','contentTrust':'untrusted-book-and-user-content','records':records},ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
 print('Wrote',len(records),'records to',args.output)
if __name__=='__main__':main()
