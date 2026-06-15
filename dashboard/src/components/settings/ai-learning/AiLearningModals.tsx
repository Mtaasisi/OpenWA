import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ModalOverlay } from '../../ModalOverlay';
import { useToast } from '../../Toast';
import {
  aiLearningApi,
  productDemandApi,
  productsApi,
  type AiLearningItem,
  type AiLearningKnowledge,
  type AiLearningSettings,
  type MissingProductRequest,
  type ProductCatalogRequest,
  type ProductDemandRecommendation,
  type ProductDemandSummaryRow,
} from '../../../services/api';
import { inboxDeepLink } from '../../customers/customer-utils';
import { AiProductSearchField } from './AiProductSearchField';
import { AiProductCatalogPicker } from './AiProductCatalogPicker';
import { useFollowupStaffQuery, useSessionsQuery } from '../../../hooks/queries';
import { AiMapMissingInboxSend } from './AiMapMissingInboxSend';
import { formatCatalogRequestStatus, formatLearningOutcome, learningToneOptions } from './learning-i18n';

const KNOWLEDGE_FILES = [
  'SHOP.md',
  'FAQ_KNOWLEDGE.md',
  'FAQ.md',
  'PRODUCT_QA.md',
  'WARRANTY_RULES.md',
  'DELIVERY_RULES.md',
  'PAYMENT_RULES.md',
  'INSTALLMENT_RULES.md',
  'AI_REPLY_EXAMPLES.md',
];

type ReviewModalProps = {
  item: AiLearningItem;
  onClose: () => void;
};

export function ReviewUnknownQuestionModal({ item, onClose }: ReviewModalProps) {
  const { t } = useTranslation();
  const toast = useToast();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [answer, setAnswer] = useState(item.aiDraftAnswer ?? '');
  const [targetFile, setTargetFile] = useState(item.targetFile ?? 'FAQ.md');
  const [category, setCategory] = useState(item.knowledgeCategory ?? '');
  const [note, setNote] = useState(item.internalNote ?? '');

  const { data: similar = [] } = useQuery({
    queryKey: ['ai-learning', 'similar', item.id],
    queryFn: () => aiLearningApi.getSimilar(item.id),
  });

  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: ['ai-learning'] });
    onClose();
  };

  const replyTeach = useMutation({
    mutationFn: () =>
      aiLearningApi.replyAndTeach(item.id, {
        adminFinalAnswer: answer,
        targetFile,
        category: category || undefined,
      }),
    onSuccess: () => { toast.success(t('ai.learning.modals.review.toastReplyTeach')); invalidate(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const teachOnly = useMutation({
    mutationFn: () =>
      aiLearningApi.teachOnly(item.id, {
        adminFinalAnswer: answer,
        targetFile,
        category: category || undefined,
      }),
    onSuccess: () => { toast.success(t('ai.learning.modals.review.toastKnowledgeSaved')); invalidate(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const replyOnly = useMutation({
    mutationFn: () => aiLearningApi.replyOnly(item.id, { answer }),
    onSuccess: () => { toast.success(t('ai.learning.modals.review.toastReplySent')); invalidate(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const reject = useMutation({
    mutationFn: () => aiLearningApi.rejectItem(item.id),
    onSuccess: () => { toast.success(t('ai.learning.modals.review.toastRejected')); invalidate(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const ignore = useMutation({
    mutationFn: () => aiLearningApi.ignoreItem(item.id),
    onSuccess: () => { toast.success(t('ai.learning.modals.review.toastIgnored')); invalidate(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const openChat = () => {
    if (item.sessionId && item.chatId) {
      navigate(inboxDeepLink(item.sessionId, item.chatId));
      onClose();
    }
  };

  return (
    <ModalOverlay onClose={onClose}>
      <div className="ail-modal" onClick={e => e.stopPropagation()} role="dialog">
        <h3>{t('ai.learning.modals.review.title')}</h3>
        <div className="ail-field"><label>{t('ai.learning.modals.review.customerQuestion')}</label><p>{item.question}</p></div>
        <div className="ail-field"><label>{t('ai.learning.table.confidence')}</label><p>{Math.round(item.confidenceScore * 100)}%</p></div>
        {item.whyUnsure && <div className="ail-field"><label>{t('ai.learning.modals.review.whyUnsure')}</label><p>{item.whyUnsure}</p></div>}
        {item.contextMessages?.length ? (
          <div className="ail-field">
            <label>{t('ai.learning.modals.review.recentContext')}</label>
            <ul className="ail-muted">
              {item.contextMessages.slice(-5).map((m, i) => (
                <li key={i}><strong>{m.role}:</strong> {m.body}</li>
              ))}
            </ul>
          </div>
        ) : null}
        {similar.length > 0 && (
          <div className="ail-field">
            <label>{t('ai.learning.modals.review.similarQuestions')}</label>
            <ul>{similar.map(s => <li key={s.id}>{s.question}</li>)}</ul>
          </div>
        )}
        <div className="ail-field">
          <label>{t('ai.learning.modals.review.adminFinalAnswer')}</label>
          <textarea rows={4} value={answer} onChange={e => setAnswer(e.target.value)} />
        </div>
        <div className="ail-field">
          <label>{t('ai.learning.modals.review.targetKnowledgeFile')}</label>
          <select value={targetFile} onChange={e => setTargetFile(e.target.value)}>
            {KNOWLEDGE_FILES.map(f => <option key={f} value={f}>{f}</option>)}
          </select>
        </div>
        <div className="ail-field">
          <label>{t('ai.learning.filters.category')}</label>
          <input value={category} onChange={e => setCategory(e.target.value)} />
        </div>
        <div className="ail-field">
          <label>{t('ai.learning.modals.review.internalNote')}</label>
          <input value={note} onChange={e => setNote(e.target.value)} />
        </div>
        <div className="ail-modal__actions">
          <button type="button" className="ail-btn ail-btn--primary" disabled={replyTeach.isPending} onClick={() => replyTeach.mutate()}>{t('ai.learning.modals.review.replyTeach')}</button>
          <button type="button" className="ail-btn" disabled={teachOnly.isPending} onClick={() => teachOnly.mutate()}>{t('ai.learning.modals.review.teachOnly')}</button>
          <button type="button" className="ail-btn" disabled={replyOnly.isPending} onClick={() => replyOnly.mutate()}>{t('ai.learning.modals.review.replyOnly')}</button>
          <button type="button" className="ail-btn" onClick={() => reject.mutate()}>{t('ai.learning.actions.reject')}</button>
          <button type="button" className="ail-btn" onClick={() => ignore.mutate()}>{t('ai.learning.actions.ignore')}</button>
          <button type="button" className="ail-btn" onClick={openChat}>{t('ai.learning.modals.review.openFullChat')}</button>
          <button type="button" className="ail-btn" onClick={onClose}>{t('common.cancel')}</button>
        </div>
      </div>
    </ModalOverlay>
  );
}

type EditSuggestedProps = { item: AiLearningItem; onClose: () => void };

export function EditSuggestedAnswerModal({ item, onClose }: EditSuggestedProps) {
  const { t } = useTranslation();
  const toast = useToast();
  const qc = useQueryClient();
  const tones = learningToneOptions(t);
  const [answer, setAnswer] = useState(item.aiDraftAnswer ?? '');
  const [tone, setTone] = useState(item.tone ?? 'boss_friendly_mtaani');
  const [targetFile, setTargetFile] = useState(item.targetFile ?? 'FAQ.md');
  const [category] = useState(item.knowledgeCategory ?? '');
  const [reviewDays, setReviewDays] = useState(String(item.reviewPeriodDays ?? 0));

  const approve = useMutation({
    mutationFn: () =>
      aiLearningApi.approveItem(item.id, {
        adminFinalAnswer: answer,
        targetFile,
        category: category || undefined,
      }),
    onSuccess: () => {
      toast.success(t('ai.learning.modals.suggested.toastApproved'));
      void qc.invalidateQueries({ queryKey: ['ai-learning'] });
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <ModalOverlay onClose={onClose}>
      <div className="ail-modal" onClick={e => e.stopPropagation()}>
        <h3>{t('ai.learning.modals.suggested.title')}</h3>
        <div className="ail-field"><label>{t('ai.learning.table.question')}</label><p>{item.question}</p></div>
        <div className="ail-field">
          <label>{t('ai.learning.modals.suggested.finalAnswer')}</label>
          <textarea rows={4} value={answer} onChange={e => setAnswer(e.target.value)} />
        </div>
        <div className="ail-field">
          <label>{t('ai.learning.modals.suggested.tone')}</label>
          <select value={tone} onChange={e => setTone(e.target.value)}>
            {tones.map(opt => <option key={opt.id} value={opt.id}>{opt.label}</option>)}
          </select>
        </div>
        <div className="ail-field">
          <label>{t('ai.learning.modals.suggested.targetFile')}</label>
          <select value={targetFile} onChange={e => setTargetFile(e.target.value)}>
            {KNOWLEDGE_FILES.map(f => <option key={f} value={f}>{f}</option>)}
          </select>
        </div>
        <div className="ail-field">
          <label>{t('ai.learning.modals.suggested.reviewPeriod')}</label>
          <select value={reviewDays} onChange={e => setReviewDays(e.target.value)}>
            <option value="0">{t('ai.learning.modals.suggested.noReview')}</option>
            <option value="30">{t('ai.learning.modals.suggested.days30')}</option>
            <option value="60">{t('ai.learning.modals.suggested.days60')}</option>
            <option value="90">{t('ai.learning.modals.suggested.days90')}</option>
          </select>
        </div>
        <div className="ail-modal__actions">
          <button type="button" className="ail-btn ail-btn--primary" onClick={() => approve.mutate()}>{t('ai.learning.modals.suggested.saveApprove')}</button>
          <button type="button" className="ail-btn" onClick={() => aiLearningApi.rejectItem(item.id).then(onClose)}>{t('ai.learning.actions.reject')}</button>
          <button type="button" className="ail-btn" onClick={onClose}>{t('common.cancel')}</button>
        </div>
      </div>
    </ModalOverlay>
  );
}

type EditKnowledgeProps = { row: AiLearningKnowledge; onClose: () => void };

export function EditApprovedKnowledgeModal({ row, onClose }: EditKnowledgeProps) {
  const { t } = useTranslation();
  const toast = useToast();
  const qc = useQueryClient();
  const [answer, setAnswer] = useState(row.approvedAnswer);
  const [pattern, setPattern] = useState(row.questionPattern);
  const [active, setActive] = useState(row.status === 'active');

  const save = useMutation({
    mutationFn: () =>
      aiLearningApi.patchKnowledge(row.id, {
        approvedAnswer: answer,
        questionPattern: pattern,
        status: active ? 'active' : 'disabled',
      }),
    onSuccess: () => {
      toast.success(t('ai.learning.modals.approved.toastSaved'));
      void qc.invalidateQueries({ queryKey: ['ai-learning'] });
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <ModalOverlay onClose={onClose}>
      <div className="ail-modal" onClick={e => e.stopPropagation()}>
        <h3>{t('ai.learning.modals.approved.title')}</h3>
        <div className="ail-field"><label>{t('ai.learning.modals.approved.questionPattern')}</label><input value={pattern} onChange={e => setPattern(e.target.value)} /></div>
        <div className="ail-field"><label>{t('ai.learning.modals.approved.approvedAnswer')}</label><textarea rows={4} value={answer} onChange={e => setAnswer(e.target.value)} /></div>
        <div className="ail-field"><label>{t('ai.learning.modals.approved.timesUsed')}</label><p>{row.timesUsed}</p></div>
        <div className="ail-field"><label><input type="checkbox" checked={active} onChange={e => setActive(e.target.checked)} /> {t('ai.learning.modals.approved.active')}</label></div>
        <div className="ail-modal__actions">
          <button type="button" className="ail-btn ail-btn--primary" onClick={() => save.mutate()}>{t('ai.learning.modals.approved.saveChanges')}</button>
          <button type="button" className="ail-btn" onClick={() => aiLearningApi.markKnowledgeNeedsReview(row.id).then(onClose)}>{t('ai.learning.modals.approved.markNeedsReview')}</button>
          <button type="button" className="ail-btn" onClick={onClose}>{t('common.cancel')}</button>
        </div>
      </div>
    </ModalOverlay>
  );
}

type DemandDetailProps = { row: ProductDemandSummaryRow; onClose: () => void };

export function ProductDemandDetailsModal({ row, onClose }: DemandDetailProps) {
  const { t } = useTranslation();
  const { data } = useQuery({
    queryKey: ['product-demand', 'detail', row.id],
    queryFn: () => productDemandApi.getItem(row.id),
  });

  return (
    <ModalOverlay onClose={onClose}>
      <div className="ail-modal" onClick={e => e.stopPropagation()}>
        <h3>{t('ai.learning.modals.demand.title')}</h3>
        <p><strong>{row.detectedProductName ?? row.productId}</strong></p>
        <p className="ail-muted">{t('ai.learning.modals.demand.stats', { requests: row.requestCount, installment: row.installmentRequests, oos: row.outOfStockCount })}</p>
        {(data as { recentEvents?: Array<{ rawMessage?: string }> })?.recentEvents?.slice(0, 5).map((e, i) => (
          <p key={i} className="ail-muted">{e.rawMessage}</p>
        ))}
        <div className="ail-modal__actions">
          <button type="button" className="ail-btn" onClick={() => productDemandApi.createStockingReminder({ productId: row.productId ?? undefined, productName: row.detectedProductName ?? undefined })}>{t('ai.learning.recommendation.createStocking')}</button>
          <button type="button" className="ail-btn" onClick={onClose}>{t('common.close')}</button>
        </div>
      </div>
    </ModalOverlay>
  );
}

type MapMissingProps = { row: MissingProductRequest; onClose: () => void };

export function MapMissingProductModal({
  row,
  onClose,
  onCreateRequest,
}: MapMissingProps & { onCreateRequest?: () => void }) {
  const { t } = useTranslation();
  const toast = useToast();
  const qc = useQueryClient();
  const { data: sessions = [] } = useSessionsQuery();
  const [productId, setProductId] = useState(row.suggestedProductId ?? '');
  const [productName, setProductName] = useState('');
  const [alias, setAlias] = useState(row.rawProductName);
  const [selectedChatKey, setSelectedChatKey] = useState('');

  const { data: missingDetail } = useQuery({
    queryKey: ['product-demand', 'missing', row.id],
    queryFn: () => productDemandApi.getMissingDetail(row.id),
  });

  const recentChats = missingDetail?.recentChats ?? [];
  const selectedChat =
    recentChats.find(c => `${c.sessionId}:${c.chatId}` === selectedChatKey) ?? recentChats[0] ?? null;
  const selectedSession = sessions.find(s => s.id === selectedChat?.sessionId);

  const selectProduct = (p: { id: string; name: string }) => {
    setProductId(p.id);
    setProductName(p.name);
  };

  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: ['product-demand'] });
  };

  const map = useMutation({
    mutationFn: () =>
      productDemandApi.mapMissing(row.id, { productId, aliasNames: [alias] }),
    onSuccess: () => {
      toast.success(t('ai.learning.mapMissing.mapped'));
      invalidate();
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const mapAndSend = useMutation({
    mutationFn: async () => {
      if (!selectedChat) throw new Error(t('ai.learning.mapMissing.pickChat'));
      await productDemandApi.mapMissing(row.id, { productId, aliasNames: [alias] });
      await productsApi.send(productId, {
        sessionId: selectedChat.sessionId,
        chatId: selectedChat.chatId,
        includeAllVariants: true,
        inStockOnly: true,
        includeImage: true,
      });
    },
    onSuccess: () => {
      toast.success(t('ai.learning.mapMissing.mappedAndSent', { name: productName }));
      invalidate();
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <ModalOverlay onClose={onClose}>
      <div className="ail-modal" onClick={e => e.stopPropagation()}>
        <h3>{t('ai.learning.mapMissing.title')}</h3>
        <div className="ail-field"><label>{t('ai.learning.mapMissing.rawName')}</label><p>{row.rawProductName}</p></div>
        {row.exampleMessages?.length ? (
          <div className="ail-field">
            <label>{t('ai.learning.mapMissing.exampleMessages')}</label>
            <ul className="ail-muted">{row.exampleMessages.slice(0, 3).map((m, i) => <li key={i}>{m}</li>)}</ul>
          </div>
        ) : null}
        <div className="ail-field">
          <label>{t('ai.learning.mapMissing.searchProduct')}</label>
          <div className="ail-field-row">
            <AiProductSearchField value={productId} onSelect={selectProduct} />
            <AiProductCatalogPicker onSelect={selectProduct} />
          </div>
        </div>
        {productName && <p className="ail-muted">{t('ai.learning.mapMissing.mappingTo', { name: productName })}</p>}
        <div className="ail-field"><label>{t('ai.learning.mapMissing.aliasNames')}</label><input value={alias} onChange={e => setAlias(e.target.value)} /></div>
        <AiMapMissingInboxSend
          chats={recentChats}
          selectedChatKey={selectedChatKey || (selectedChat ? `${selectedChat.sessionId}:${selectedChat.chatId}` : '')}
          onSelectChatKey={setSelectedChatKey}
          sessionStatus={selectedSession?.status}
          productId={productId}
          productName={productName || row.rawProductName}
          onSent={invalidate}
        />
        <div className="ail-modal__actions">
          <button type="button" className="ail-btn ail-btn--primary" disabled={!productId || map.isPending} onClick={() => map.mutate()}>{t('ai.learning.mapMissing.mapProduct')}</button>
          <button
            type="button"
            className="ail-btn ail-btn--primary"
            disabled={!productId || !selectedChat || mapAndSend.isPending}
            onClick={() => mapAndSend.mutate()}
          >
            {t('ai.learning.mapMissing.mapAndSend')}
          </button>
          <button type="button" className="ail-btn" disabled={!productId || map.isPending} onClick={() => map.mutate()}>{t('ai.learning.mapMissing.mapAlias')}</button>
          <button type="button" className="ail-btn" onClick={() => { onClose(); onCreateRequest?.(); }}>{t('ai.learning.mapMissing.createTask')}</button>
          <button type="button" className="ail-btn" onClick={() => productDemandApi.ignoreMissing(row.id).then(onClose)}>{t('ai.learning.actions.ignore')}</button>
          <button type="button" className="ail-btn" onClick={onClose}>{t('common.cancel')}</button>
        </div>
      </div>
    </ModalOverlay>
  );
}

type CreateRequestProps = {
  initial?: Partial<MissingProductRequest>;
  onClose: () => void;
};

export function CreateProductRequestModal({ initial, onClose }: CreateRequestProps) {
  const { t } = useTranslation();
  const toast = useToast();
  const qc = useQueryClient();
  const { data: staff = [] } = useFollowupStaffQuery();
  const [productName, setProductName] = useState(initial?.rawProductName ?? '');
  const [category, setCategory] = useState(initial?.possibleCategory ?? '');
  const [brand, setBrand] = useState(initial?.brand ?? '');
  const [specs, setSpecs] = useState('');
  const [priority, setPriority] = useState('medium');
  const [notes, setNotes] = useState('');
  const [assignedStaffId, setAssignedStaffId] = useState('');
  const [dueDate, setDueDate] = useState('');

  const submit = useMutation({
    mutationFn: (createStockingReminder: boolean) =>
      productDemandApi.createProductRequest({
        productName,
        category: category || undefined,
        brand: brand || undefined,
        suggestedSpecs: specs || undefined,
        branchId: initial?.branchId ?? undefined,
        customerCount: initial?.uniqueCustomers ?? initial?.timesAsked,
        exampleMessages: initial?.exampleMessages ?? undefined,
        priority,
        notes: notes || undefined,
        assignedStaffId: assignedStaffId || undefined,
        dueDate: dueDate || undefined,
        missingProductRequestId: initial?.id,
        createStockingReminder,
      }),
    onSuccess: () => {
      toast.success(t('ai.learning.modals.createRequest.toastCreated'));
      void qc.invalidateQueries({ queryKey: ['product-demand'] });
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <ModalOverlay onClose={onClose}>
      <div className="ail-modal" onClick={e => e.stopPropagation()}>
        <h3>{t('ai.learning.modals.createRequest.title')}</h3>
        <div className="ail-field"><label>{t('ai.learning.modals.createRequest.productName')}</label><input value={productName} onChange={e => setProductName(e.target.value)} /></div>
        <div className="ail-field"><label>{t('ai.learning.filters.category')}</label><input value={category} onChange={e => setCategory(e.target.value)} /></div>
        <div className="ail-field"><label>{t('ai.learning.filters.brand')}</label><input value={brand} onChange={e => setBrand(e.target.value)} /></div>
        <div className="ail-field"><label>{t('ai.learning.modals.createRequest.suggestedSpecs')}</label><textarea rows={2} value={specs} onChange={e => setSpecs(e.target.value)} /></div>
        <div className="ail-field"><label>{t('ai.learning.modals.createRequest.customersAsking')}</label><input type="number" min={1} value={initial?.uniqueCustomers ?? 1} readOnly /></div>
        <div className="ail-field">
          <label>{t('ai.learning.table.priority')}</label>
          <select value={priority} onChange={e => setPriority(e.target.value)}>
            <option value="low">{t('ai.learning.modals.priority.low')}</option>
            <option value="medium">{t('ai.learning.modals.priority.medium')}</option>
            <option value="high">{t('ai.learning.modals.priority.high')}</option>
            <option value="urgent">{t('ai.learning.modals.priority.urgent')}</option>
          </select>
        </div>
        <div className="ail-field">
          <label>{t('ai.learning.modals.createRequest.assignedStaff')}</label>
          <select value={assignedStaffId} onChange={e => setAssignedStaffId(e.target.value)}>
            <option value="">—</option>
            {staff.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
        <div className="ail-field"><label>{t('ai.learning.modals.createRequest.dueDate')}</label><input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} /></div>
        <div className="ail-field"><label>{t('ai.learning.modals.createRequest.notes')}</label><textarea rows={2} value={notes} onChange={e => setNotes(e.target.value)} /></div>
        <div className="ail-modal__actions">
          <button type="button" className="ail-btn ail-btn--primary" disabled={!productName.trim() || submit.isPending} onClick={() => submit.mutate(false)}>{t('ai.learning.modals.createRequest.submit')}</button>
          <button type="button" className="ail-btn" disabled={submit.isPending} onClick={() => submit.mutate(true)}>{t('ai.learning.modals.createRequest.submitStocking')}</button>
          <button type="button" className="ail-btn" onClick={onClose}>{t('common.cancel')}</button>
        </div>
      </div>
    </ModalOverlay>
  );
}

type CatalogRequestProps = { request: ProductCatalogRequest; onClose: () => void };

export function ProductCatalogRequestModal({ request, onClose }: CatalogRequestProps) {
  const { t } = useTranslation();
  const toast = useToast();
  const qc = useQueryClient();
  const { data: staff = [] } = useFollowupStaffQuery();
  const [notes, setNotes] = useState(request.notes ?? '');
  const [priority, setPriority] = useState(request.priority);
  const [status, setStatus] = useState(request.status);
  const [assignedStaffId, setAssignedStaffId] = useState(request.assignedStaffId ?? '');
  const [dueDate, setDueDate] = useState(request.dueDate?.slice(0, 10) ?? '');
  const [linkProductId, setLinkProductId] = useState(request.productId ?? '');
  const [linkProductName, setLinkProductName] = useState(request.linkedProductName ?? '');

  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: ['product-demand'] });
  };

  const save = useMutation({
    mutationFn: () =>
      productDemandApi.updateProductRequest(request.id, {
        notes: notes || undefined,
        priority,
        status,
        assignedStaffId: assignedStaffId || undefined,
        dueDate: dueDate || '',
      }),
    onSuccess: () => {
      toast.success(t('ai.learning.modals.productRequest.toastUpdated'));
      invalidate();
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const quickStatus = useMutation({
    mutationFn: (next: string) => productDemandApi.updateProductRequest(request.id, { status: next }),
    onSuccess: () => {
      toast.success(t('ai.learning.modals.productRequest.toastUpdated'));
      invalidate();
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const linkProduct = useMutation({
    mutationFn: () => productDemandApi.linkProductRequest(request.id, linkProductId),
    onSuccess: () => {
      toast.success(t('ai.learning.modals.productRequest.toastLinked'));
      invalidate();
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const isClosed = status === 'done' || status === 'cancelled';
  const linkedLabel = request.linkedProductName ?? linkProductName;

  return (
    <ModalOverlay onClose={onClose}>
      <div className="ail-modal" onClick={e => e.stopPropagation()}>
        <h3>{t('ai.learning.modals.productRequest.title')}</h3>
        <p><strong>{request.productName}</strong></p>
        <p className="ail-muted">
          {[
            request.category,
            request.brand,
            t('ai.learning.modals.createRequest.customersAsking') + `: ${request.customerCount}`,
          ].filter(Boolean).join(' · ')}
        </p>
        {request.suggestedSpecs ? (
          <div className="ail-field">
            <label>{t('ai.learning.modals.createRequest.suggestedSpecs')}</label>
            <p className="ail-muted">{request.suggestedSpecs}</p>
          </div>
        ) : null}
        {request.exampleMessages?.length ? (
          <div className="ail-field">
            <label>{t('ai.learning.modals.productRequest.exampleMessages')}</label>
            <ul className="ail-muted">{request.exampleMessages.slice(0, 5).map((m, i) => <li key={i}>{m}</li>)}</ul>
          </div>
        ) : null}
        {linkedLabel ? (
          <div className="ail-field">
            <label>{t('ai.learning.modals.productRequest.linkedProduct')}</label>
            <p className="ail-muted">{linkedLabel}</p>
          </div>
        ) : !isClosed ? (
          <div className="ail-field">
            <label>{t('ai.learning.modals.productRequest.linkToCatalog')}</label>
            <div className="ail-field-row">
              <AiProductSearchField
                value={linkProductId}
                onSelect={p => {
                  setLinkProductId(p.id);
                  setLinkProductName(p.name);
                }}
              />
              <AiProductCatalogPicker
                onSelect={p => {
                  setLinkProductId(p.id);
                  setLinkProductName(p.name);
                }}
              />
            </div>
            {linkProductName ? (
              <p className="ail-muted">{t('ai.learning.mapMissing.mappingTo', { name: linkProductName })}</p>
            ) : null}
          </div>
        ) : null}
        <div className="ail-field">
          <label>{t('ai.learning.table.status')}</label>
          <select value={status} onChange={e => setStatus(e.target.value)} disabled={isClosed}>
            <option value="open">{formatCatalogRequestStatus(t, 'open')}</option>
            <option value="in_progress">{formatCatalogRequestStatus(t, 'in_progress')}</option>
            <option value="done">{formatCatalogRequestStatus(t, 'done')}</option>
            <option value="cancelled">{formatCatalogRequestStatus(t, 'cancelled')}</option>
          </select>
        </div>
        <div className="ail-field">
          <label>{t('ai.learning.table.priority')}</label>
          <select value={priority} onChange={e => setPriority(e.target.value)} disabled={isClosed}>
            <option value="low">{t('ai.learning.modals.priority.low')}</option>
            <option value="medium">{t('ai.learning.modals.priority.medium')}</option>
            <option value="high">{t('ai.learning.modals.priority.high')}</option>
            <option value="urgent">{t('ai.learning.modals.priority.urgent')}</option>
          </select>
        </div>
        <div className="ail-field">
          <label>{t('ai.learning.modals.createRequest.assignedStaff')}</label>
          <select value={assignedStaffId} onChange={e => setAssignedStaffId(e.target.value)} disabled={isClosed}>
            <option value="">—</option>
            {staff.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
        <div className="ail-field">
          <label>{t('ai.learning.modals.createRequest.dueDate')}</label>
          <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} disabled={isClosed} />
        </div>
        <div className="ail-field">
          <label>{t('ai.learning.modals.createRequest.notes')}</label>
          <textarea rows={3} value={notes} onChange={e => setNotes(e.target.value)} disabled={isClosed} />
        </div>
        <div className="ail-modal__actions">
          {!isClosed && !request.productId && linkProductId && (
            <button
              type="button"
              className="ail-btn ail-btn--primary"
              disabled={linkProduct.isPending}
              onClick={() => linkProduct.mutate()}
            >
              {t('ai.learning.modals.productRequest.linkAndComplete')}
            </button>
          )}
          {!isClosed && status === 'open' && (
            <button type="button" className="ail-btn" disabled={quickStatus.isPending} onClick={() => quickStatus.mutate('in_progress')}>
              {t('ai.learning.modals.productRequest.markInProgress')}
            </button>
          )}
          {!isClosed && (
            <>
              <button type="button" className="ail-btn ail-btn--primary" disabled={quickStatus.isPending} onClick={() => quickStatus.mutate('done')}>
                {t('ai.learning.modals.productRequest.complete')}
              </button>
              <button type="button" className="ail-btn" disabled={quickStatus.isPending} onClick={() => quickStatus.mutate('cancelled')}>
                {t('ai.learning.modals.productRequest.cancel')}
              </button>
            </>
          )}
          {!isClosed && (
            <button type="button" className="ail-btn" disabled={save.isPending} onClick={() => save.mutate()}>
              {t('ai.learning.modals.productRequest.save')}
            </button>
          )}
          <button type="button" className="ail-btn" onClick={onClose}>{t('common.close')}</button>
        </div>
      </div>
    </ModalOverlay>
  );
}

type RecProps = { rec: ProductDemandRecommendation; onClose: () => void };

export function RecommendationActionModal({ rec, onClose }: RecProps) {
  const { t } = useTranslation();
  const toast = useToast();
  const qc = useQueryClient();
  const navigate = useNavigate();

  const act = (action: string) =>
    productDemandApi.recommendationAction(rec.id, action).then(res => {
      if (action === 'task' && res.taskId) {
        toast.success(t('ai.learning.recommendation.requestCreated'));
      } else if (action === 'campaign' && res.campaignPrefill) {
        navigate('/campaigns', {
          state: {
            smsCampaignPrefill: res.campaignPrefill,
            demandCampaignId: res.campaignId,
          },
        });
        toast.success(t('ai.learning.recommendation.campaignReady'));
      } else {
        toast.success(t('common.done', 'Done'));
      }
      void qc.invalidateQueries({ queryKey: ['product-demand'] });
      onClose();
    });

  return (
    <ModalOverlay onClose={onClose}>
      <div className="ail-modal" onClick={e => e.stopPropagation()}>
        <h3>{rec.title}</h3>
        <p>{rec.reason}</p>
        <p className="ail-muted">{rec.dataProof}</p>
        <div className="ail-modal__actions">
          <button type="button" className="ail-btn" onClick={() => act('stocking')}>{t('ai.learning.recommendation.createStocking')}</button>
          <button type="button" className="ail-btn" onClick={() => act('task')}>{t('ai.learning.recommendation.createRequest')}</button>
          <button type="button" className="ail-btn" onClick={() => act('campaign')}>{t('ai.learning.recommendation.startCampaign')}</button>
          <button type="button" className="ail-btn" onClick={() => act('done')}>{t('ai.learning.recommendation.markDone')}</button>
          <button type="button" className="ail-btn" onClick={() => productDemandApi.dismissRecommendation(rec.id).then(onClose)}>{t('ai.learning.recommendation.dismiss')}</button>
          <button type="button" className="ail-btn" onClick={onClose}>{t('common.cancel')}</button>
        </div>
      </div>
    </ModalOverlay>
  );
}

type HistoryProps = { item: AiLearningItem; onClose: () => void };

export function LearningHistoryDetailsModal({ item, onClose }: HistoryProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  return (
    <ModalOverlay onClose={onClose}>
      <div className="ail-modal" onClick={e => e.stopPropagation()}>
        <h3>{t('ai.learning.modals.history.title')}</h3>
        <div className="ail-field"><label>{t('ai.learning.table.question')}</label><p>{item.question}</p></div>
        <div className="ail-field"><label>{t('ai.learning.modals.history.finalAnswer')}</label><p>{item.adminFinalAnswer}</p></div>
        <div className="ail-field"><label>{t('ai.learning.modals.history.approvedBy')}</label><p>{item.approvedBy ?? '—'}</p></div>
        <div className="ail-field"><label>{t('ai.learning.modals.history.customerOutcome')}</label><p>{formatLearningOutcome(t, item.outcome)}</p></div>
        <div className="ail-modal__actions">
          {item.sessionId && item.chatId && (
            <button type="button" className="ail-btn" onClick={() => navigate(inboxDeepLink(item.sessionId!, item.chatId!))}>{t('ai.learning.modals.history.openChat')}</button>
          )}
          <button type="button" className="ail-btn" onClick={onClose}>{t('common.close')}</button>
        </div>
      </div>
    </ModalOverlay>
  );
}

type SettingsModalProps = { settings: AiLearningSettings; onClose: () => void };

export function LearningSettingsModal({ settings, onClose }: SettingsModalProps) {
  const { t } = useTranslation();
  const toast = useToast();
  const qc = useQueryClient();
  const [draft, setDraft] = useState(settings);

  const save = useMutation({
    mutationFn: () => aiLearningApi.patchSettings(draft),
    onSuccess: () => {
      toast.success(t('ai.learning.modals.learningSettings.toastSaved'));
      void qc.invalidateQueries({ queryKey: ['ai-learning'] });
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <ModalOverlay onClose={onClose}>
      <div className="ail-modal" onClick={e => e.stopPropagation()}>
        <h3>{t('ai.learning.modals.learningSettings.title')}</h3>
        <div className="ail-field">
          <label><input type="checkbox" checked={draft.enableLearningDetection} onChange={e => setDraft({ ...draft, enableLearningDetection: e.target.checked })} /> {t('ai.learning.modals.learningSettings.enableDetection')}</label>
        </div>
        <div className="ail-field">
          <label><input type="checkbox" checked={draft.trackCustomerOutcome} onChange={e => setDraft({ ...draft, trackCustomerOutcome: e.target.checked })} /> {t('ai.learning.modals.learningSettings.trackOutcome')}</label>
        </div>
        <div className="ail-field">
          <label>{t('ai.learning.modals.learningSettings.highThreshold')}</label>
          <input type="number" step="0.05" min="0" max="1" value={draft.highConfidenceThreshold} onChange={e => setDraft({ ...draft, highConfidenceThreshold: Number(e.target.value) })} />
        </div>
        <div className="ail-field">
          <label>{t('ai.learning.modals.learningSettings.mediumThreshold')}</label>
          <input type="number" step="0.05" min="0" max="1" value={draft.mediumConfidenceThreshold} onChange={e => setDraft({ ...draft, mediumConfidenceThreshold: Number(e.target.value) })} />
        </div>
        <div className="ail-field">
          <label>{t('ai.learning.modals.learningSettings.defaultUnknownReply')}</label>
          <textarea rows={2} value={draft.defaultUnknownReply} onChange={e => setDraft({ ...draft, defaultUnknownReply: e.target.value })} />
        </div>
        <div className="ail-modal__actions">
          <button type="button" className="ail-btn ail-btn--primary" onClick={() => save.mutate()}>{t('ai.learning.modals.learningSettings.saveSettings')}</button>
          <button type="button" className="ail-btn" onClick={() => aiLearningApi.resetSettings().then(() => { void qc.invalidateQueries({ queryKey: ['ai-learning'] }); onClose(); })}>{t('ai.learning.modals.learningSettings.resetDefaults')}</button>
          <button type="button" className="ail-btn" onClick={onClose}>{t('common.cancel')}</button>
        </div>
      </div>
    </ModalOverlay>
  );
}
