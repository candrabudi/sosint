import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import {
  type BulkLinksInput, bulkLinksSchema, commentQuerySchema, type CommentQueryPayload, type CreateDataUrlPayload, createDataUrlSchema, type DataUrlQueryPayload, dataUrlQuerySchema, type LinkPayload, linkInputSchema,
  type UpdateDataUrlInput, updateDataUrlSchema, type UpdateLinkInput, updateLinkSchema,
} from '@sig/shared';
import type { AuthUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/decorators';
import { ZodValidationPipe } from '../zod-validation.pipe';
import { DataUrlsService } from './data-urls.service';

const uuid = new ParseUUIDPipe();

@Controller('data-urls')
export class DataUrlsController {
  constructor(private readonly service: DataUrlsService) {}

  @Get()
  findAll(@Query(new ZodValidationPipe(dataUrlQuerySchema)) query: DataUrlQueryPayload) {
    return this.service.findAll(query);
  }

  // harus di atas ':id' agar tidak tertangkap sebagai id
  @Get('tags')
  findTags() {
    return this.service.findTags();
  }

  @Get(':id')
  findOne(@Param('id', uuid) id: string) {
    return this.service.findOne(id);
  }

  /** Total harian (riwayat) satu Data Url. */
  @Get(':id/history')
  history(@Param('id', uuid) id: string) {
    return this.service.dataUrlHistory(id);
  }

  /** Komentar semua link dalam Data Url (ber-halaman, bisa difilter per link/sentimen). */
  @Get(':id/comments')
  comments(@Param('id', uuid) id: string, @Query(new ZodValidationPipe(commentQuerySchema)) query: CommentQueryPayload) {
    return this.service.listComments(id, query);
  }

  /** Semua snapshot satu link. */
  @Get(':id/links/:linkId/history')
  linkHistory(@Param('id', uuid) id: string, @Param('linkId', uuid) linkId: string) {
    return this.service.linkHistory(id, linkId);
  }

  @Post()
  create(@Body(new ZodValidationPipe(createDataUrlSchema)) body: CreateDataUrlPayload, @CurrentUser() user: AuthUser) {
    return this.service.create(body, user.id);
  }

  @Patch(':id')
  update(@Param('id', uuid) id: string, @Body(new ZodValidationPipe(updateDataUrlSchema)) body: UpdateDataUrlInput) {
    return this.service.update(id, body);
  }

  @Delete(':id')
  remove(@Param('id', uuid) id: string) {
    return this.service.remove(id);
  }

  // ---------- links ----------

  @Post(':id/links')
  addLink(@Param('id', uuid) id: string, @Body(new ZodValidationPipe(linkInputSchema)) body: LinkPayload) {
    return this.service.addLink(id, body);
  }

  @Post(':id/links/bulk')
  addLinksBulk(@Param('id', uuid) id: string, @Body(new ZodValidationPipe(bulkLinksSchema)) body: BulkLinksInput) {
    return this.service.addLinksBulk(id, body.urls);
  }

  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @Post(':id/sync')
  syncAll(@Param('id', uuid) id: string) {
    return this.service.syncAll(id);
  }

  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  @Post(':id/links/:linkId/sync')
  syncLink(@Param('id', uuid) id: string, @Param('linkId', uuid) linkId: string) {
    return this.service.syncLink(id, linkId);
  }

  @Patch(':id/links/:linkId')
  updateLink(
    @Param('id', uuid) id: string,
    @Param('linkId', uuid) linkId: string,
    @Body(new ZodValidationPipe(updateLinkSchema)) body: UpdateLinkInput,
  ) {
    return this.service.updateLink(id, linkId, body);
  }

  @Delete(':id/links/:linkId')
  removeLink(@Param('id', uuid) id: string, @Param('linkId', uuid) linkId: string) {
    return this.service.removeLink(id, linkId);
  }
}
