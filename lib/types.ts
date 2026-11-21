export type DeviceConfig = {
  host: string;
  port: number;
  https: boolean;
  username: string;
  password: string;
};

export type ListenerConfig = {
  host: string;
  port: number;
  protocol: "HTTP" | "HTTPS";
};

export type ArtemisConfig = {
  host: string;
  port: number;
  https: boolean;
  appKey: string;
  appSecret: string;
};

export type Punch = {
  id: string;
  receivedAt: string;
  pin: string;
  name: string;
  verifyMode: string;
  majorEventType: number | null;
  subEventType: number | null;
  attendanceStatus: string;
  punchTime: string;
  deviceIp: string;
  eventType: string;
  label: string;
  photoUrl: string | null;
};

export type Person = {
  employeeNo: string;
  name: string;
  userType: string;
  gender: string;
  doorRight: string;
  beginTime: string;
  endTime: string;
  numOfFace: number | null;
  numOfFP: number | null;
  numOfCard: number | null;
};

export type PersonInput = {
  employeeNo: string;
  name: string;
  userType: "normal" | "visitor" | "blackList";
  gender: "male" | "female" | "unknown";
  beginTime: string;
  endTime: string;
  password?: string;
  faceBase64?: string;
  faceMime?: string;
};
