import { EventEmitter } from 'node:events';
import { expect,it,vi } from 'vitest';
import { Updates,updateFailure } from './updates';
function setup() {
  const driver=Object.assign(new EventEmitter(),{autoDownload:true,autoInstallOnAppQuit:true,allowPrerelease:true,allowDowngrade:true,checkForUpdates:vi.fn(async()=>{driver.emit('update-available',{version:'0.9.0'});return null;}),downloadUpdate:vi.fn(async()=>{driver.emit('download-progress',{percent:45});driver.emit('update-downloaded',{});}),quitAndInstall:vi.fn()});
  const busy=vi.fn(()=>false); const changes=vi.fn();
  return {driver,busy,changes,updates:new Updates(driver,'0.8.0',changes,busy)};
}
it('requires explicit download and restart, and blocks restart during work',async()=>{
  const {driver,busy,updates}=setup();await updates.check();expect(updates.state.phase).toBe('available');expect(driver.downloadUpdate).not.toHaveBeenCalled();
  expect(driver.autoInstallOnAppQuit).toBe(false);expect(driver.allowDowngrade).toBe(false);
  await updates.download();expect(updates.state.phase).toBe('ready');expect(driver.quitAndInstall).not.toHaveBeenCalled();
  busy.mockReturnValue(true);updates.install();expect(driver.quitAndInstall).not.toHaveBeenCalled();expect(updates.state.message).toContain('pause');
  busy.mockReturnValue(false);updates.install();expect(driver.quitAndInstall).toHaveBeenCalledWith(false,true);
});
it('recovers from offline checks and download errors without running an installer',async()=>{
  const {driver,updates}=setup();driver.checkForUpdates.mockRejectedValueOnce(new Error('offline'));await updates.check();expect(updates.state.phase).toBe('error');
  await updates.check();driver.downloadUpdate.mockRejectedValueOnce(new Error('hash mismatch'));await updates.download();expect(updates.state.phase).toBe('error');updates.install();expect(driver.quitAndInstall).not.toHaveBeenCalled();
});
it('deduplicates concurrent checks and disables unsupported builds',async()=>{
  const {driver,updates}=setup();await Promise.all([updates.check(),updates.check()]);expect(driver.checkForUpdates).toHaveBeenCalledTimes(1);
  const portable=new Updates(driver,'0.8.0',()=>{},()=>false,'Portable');await portable.check();expect(driver.checkForUpdates).toHaveBeenCalledTimes(1);
});
it('identifies missing release files separately from a connection problem',()=>{
  expect(updateFailure({code:'ERR_UPDATER_CHANNEL_FILE_NOT_FOUND',message:'Cannot find latest.yml'},'check').message).toContain('release is missing');
  expect(updateFailure({code:'ENOTFOUND'},'check').message).toContain('connection');
});
it('keeps automatic check failures quiet and makes manual errors visible',async()=>{
  const {driver,updates}=setup();driver.checkForUpdates.mockRejectedValue(new Error('broken release'));
  await updates.check(false);expect(updates.state.notify).toBe(false);expect(updates.state.phase).toBe('error');
  await updates.check();expect(updates.state.notify).toBe(true);
});
