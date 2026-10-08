export function feedLinks(base: string, token: string) {
  const https = `${base}/api/calendar/${token}.ics`;
  const webcal = https.replace(/^https?:\/\//, "webcal://");
  const name = "UVU Ambassador shifts";
  return {
    https,
    apple: webcal,
    google: `https://calendar.google.com/calendar/r?cid=${encodeURIComponent(webcal)}`,
    outlook: `https://outlook.office.com/calendar/0/addfromweb?url=${encodeURIComponent(https)}&name=${encodeURIComponent(name)}`,
  };
}
