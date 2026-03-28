import { bigEndianToInteger, integerToBigEndian } from "./ops.js";

export class ByteStream {
  private bytes: Uint8Array;
  private position: number = 0;

  constructor(bytes?: Uint8Array) {
    this.bytes = bytes ?? new Uint8Array();
  }

  read(length: number) {
    const result = this.bytes.slice(this.position, this.position + length);
    this.position += length;
    return result;
  }

  peek(amount: number) {
    return this.bytes.slice(this.position, this.position + amount);
  }

  // Concatenate bytes to the end of the stream.
  write(bytes: Uint8Array) {
    this.bytes = new Uint8Array([...this.bytes, ...bytes]);
  }

  /**
   * 
   * @param value  
   * @param length - number of bytes to write  
   */
  writeInt(value: number | bigint, length: number) {
    this.write(integerToBigEndian(value, length));
  }

  readVarInt(): number {
    const firstByte = this.read(1)[0];
    if (firstByte === 0xfd) return Number(bigEndianToInteger(this.read(2)));
    if (firstByte === 0xfe) return Number(bigEndianToInteger(this.read(4)));
    if (firstByte === 0xff) return Number(bigEndianToInteger(this.read(8)));
    return firstByte;
  }

  writeFloat32(value: number): void {
    const buf = new Uint8Array(4);
    new DataView(buf.buffer).setFloat32(0, value, false); // big-endian
    this.write(buf);
  }

  readFloat32(): number {
    return new DataView(this.read(4).buffer).getFloat32(0, false);
  }

  readToEnd(): Uint8Array {
    return this.read(this.bytes.length - this.position);
  }

  toBytes() {
    return this.bytes;
  }

  getPosition() {
    return this.position;
  }

  setPosition(position: number) {
    this.position = position;
  }
}
