# AI Brainstorm Room — Thinking Orchestration Engine

## 1. Ý tưởng tổng quan

**AI Brainstorm Room** là một công cụ hỗ trợ tổ chức phòng brainstorming theo hướng có điều phối, có quan sát trạng thái tư duy, có lựa chọn kỹ thuật phù hợp, và có lưu lại dấu vết phát triển của từng ý tưởng.

Công cụ này không nên được hiểu là một chatbot sinh ý tưởng thay con người. Vai trò đúng của nó là **AI Facilitator**: quan sát phiên brainstorm, phân tích chất lượng tư duy của nhóm, chẩn đoán nhóm đang thiếu gì, sau đó chọn kỹ thuật phù hợp để dẫn dắt nhóm đi tiếp.

Nguyên lý cốt lõi:

```text
Observe → Analyze → Diagnose → Select Thinking State → Choose Technique → Facilitate → Capture Thinking Trace → Observe Again
```

Vòng này lặp liên tục cho đến khi nhóm có đủ insight để ra quyết định.

---

## 2. Vấn đề mà tool giải quyết

Trong một phòng brainstorm thật, vấn đề thường không phải là thiếu ý tưởng. Vấn đề là:

- Nhóm nhảy vào giải pháp quá sớm.
- Problem statement chưa rõ nhưng đã bắt đầu brainstorm.
- Một vài người nói quá nhiều, người khác im lặng.
- Ý tưởng bị lặp quanh một hướng duy nhất.
- Nhóm chỉ nhìn vấn đề từ góc kỹ thuật mà quên user/business.
- Nhóm đồng ý quá nhanh, dẫn đến groupthink.
- Ý tưởng bị phản bác quá sớm.
- Sau buổi brainstorm chỉ còn nhiều sticky note rời rạc, không biết vì sao chọn idea này và loại idea kia.

Tool này giải quyết bằng cách biến brainstorming thành một quá trình có điều phối:

```text
Hiểu vấn đề → Tạo ý tưởng → Mở rộng góc nhìn → Phản biện → Rút insight → Ưu tiên → Chuyển thành hành động
```

---

## 3. Định nghĩa sản phẩm

### 3.1. AI Brainstorm Room là gì?

AI Brainstorm Room là một không gian brainstorm có AI điều phối. Trong đó, AI không chỉ trả lời câu hỏi mà còn:

- Theo dõi phiên thảo luận.
- Phát hiện trạng thái tư duy của nhóm.
- Chọn kỹ thuật brainstorming phù hợp.
- Điều phối người tham gia.
- Ghi lại toàn bộ quá trình phát triển ý tưởng.
- Tổng hợp insight và đề xuất bước tiếp theo.

### 3.2. Thinking Orchestration Engine là gì?

**Thinking Orchestration Engine** là lõi điều phối tư duy của hệ thống.

Nó không hoạt động theo kiểu:

```text
Phase 1 → Phase 2 → Phase 3 → Done
```

Mà hoạt động như một vòng lặp thích ứng:

```text
Quan sát trạng thái hiện tại
→ Chẩn đoán nhóm đang thiếu gì
→ Chọn chế độ tư duy cần kích hoạt
→ Chọn kỹ thuật phù hợp
→ Điều phối nhóm
→ Ghi lại trace
→ Quan sát lại
```

---

## 4. Nguyên lý cốt lõi

### Nguyên lý 1 — Brainstorm là State Machine, không phải workflow tuyến tính

Brainstorming không nên đi cứng theo một danh sách bước. Thực tế một phiên brainstorm có thể phải quay lại nhiều lần.

Ví dụ:

```text
Explore → Expand → Challenge → Explore lại → Insight → Challenge lại → Decision
```

Nếu ý tưởng đang lặp, AI không nên chuyển sang đánh giá. Nó phải quay lại mở rộng ý tưởng bằng kỹ thuật khác.

### Nguyên lý 2 — AI điều phối trạng thái tư duy, không điều phối kỹ thuật

AI không nên nghĩ:

```text
Đến bước này thì dùng Six Thinking Hats.
```

AI nên nghĩ:

```text
Nhóm đang thiếu góc nhìn đa chiều.
→ Cần Perspective Thinking.
→ Technique phù hợp: Six Thinking Hats / Role Storming / Stakeholder Lens.
```

Tức là:

```text
Need → Thinking State → Technique
```

### Nguyên lý 3 — Technique chỉ là Thinking Trigger

Các kỹ thuật như SCAMPER, Six Thinking Hats, Five Whys, Reverse Thinking không phải mục tiêu cuối cùng. Chúng chỉ là công cụ để kích hoạt một kiểu tư duy cụ thể.

Ví dụ:

| Technique | Thinking Mode được kích hoạt |
|---|---|
| SCAMPER | Creative / Divergent Thinking |
| Random Word | Associative Thinking |
| Six Thinking Hats | Perspective Thinking |
| Five Whys | Causal Thinking |
| Devil's Advocate | Critical Thinking |
| ICE / RICE | Decision Thinking |

### Nguyên lý 4 — AI đánh giá process, không đánh giá thay con người

AI không nên nói ngay:

```text
Ý tưởng A tốt hơn ý tưởng B.
```

AI nên nói:

```text
Hiện tại nhóm đang thiếu góc nhìn khách hàng.
```

Hoặc:

```text
Ý tưởng đang bị lặp quanh một hướng.
```

AI can thiệp vào **quá trình tư duy**, còn con người vẫn là người tạo ý tưởng và quyết định cuối cùng.

### Nguyên lý 5 — Thinking Trace là tài sản quan trọng

Mỗi ý tưởng cần có lịch sử hình thành:

```text
Idea A
→ Sinh ra từ SCAMPER
→ Được mở rộng bằng Six Thinking Hats
→ Bị phản biện bằng Devil's Advocate
→ Được đào sâu bằng Five Whys
→ Được chấm ICE
→ Chọn cho MVP
```

Thinking Trace giúp trả lời:

- Ý tưởng này đến từ đâu?
- Vì sao nó được chọn?
- Ai đã bổ sung?
- Rủi ro nào đã được xử lý?
- Vì sao idea khác bị loại?

---

## 5. Kiến trúc tổng quan

```text
AI Brainstorm Room
│
├── Session Observer
│   └── Quan sát dữ liệu phiên brainstorm
│
├── Session Analyzer
│   └── Phân tích chất lượng tư duy
│
├── Diagnosis Engine
│   └── Chẩn đoán trạng thái hiện tại
│
├── Thinking State Engine
│   └── Chọn mode tư duy cần kích hoạt
│
├── Technique Router
│   └── Chọn kỹ thuật phù hợp
│
├── Facilitation Engine
│   └── Điều phối nhóm thực hiện kỹ thuật
│
├── Thinking Trace Engine
│   └── Ghi lại sự tiến hóa của idea
│
├── Insight Engine
│   └── Cluster, theme, pattern, insight
│
└── Output Generator
    └── Product Brief, BRD, PRD, Event Storming, Architecture, Tech Spec
```

---

## 6. Lộ trình hoạt động theo phase

## Phase 1 — Problem Framing

### Mục tiêu

Hiểu đúng vấn đề trước khi brainstorm.

AI không được sinh ý tưởng ngay ở phase này. AI đóng vai BA/facilitator để làm rõ:

- Vấn đề là gì?
- Ai đang gặp vấn đề?
- Mục tiêu của phiên brainstorm là gì?
- Thành công được đo bằng gì?
- Constraint là gì?
- Điều gì nằm ngoài phạm vi?

### Input

```text
Topic ban đầu
Người tham gia
Mục tiêu phiên
Bối cảnh sơ bộ
```

### AI cần hỏi

```text
Chúng ta đang giải quyết vấn đề gì?
Ai là người bị ảnh hưởng chính?
Mục tiêu sau buổi brainstorm là gì?
Muốn tạo idea cho MVP, product strategy, feature hay process?
Có giới hạn về thời gian, ngân sách, kỹ thuật, pháp lý không?
```

### Output

```text
Problem Statement
Goal
Stakeholder
Constraint
Success Criteria
Scope / Out of Scope
```

### Điều kiện chuyển phase

Chỉ chuyển sang Phase 2 khi có đủ:

- Problem rõ.
- Stakeholder chính rõ.
- Mục tiêu phiên rõ.
- Constraint cơ bản rõ.

Nếu chưa rõ, AI tiếp tục hỏi.

---

## Phase 2 — Context Building

### Mục tiêu

Xây dựng ngữ cảnh đủ để brainstorm không bị hời hợt.

AI thu thập hoặc yêu cầu người dùng bổ sung:

- Business context.
- Domain context.
- User persona.
- Current workflow.
- Competitor hoặc alternative solution.
- Existing pain points.
- Technical context.
- Market/research nếu cần.

### Input

```text
Problem Statement từ Phase 1
Thông tin domain
Thông tin người dùng
Tài liệu có sẵn nếu có
```

### AI cần làm

```text
Tóm tắt context
Phát hiện lỗ hổng thông tin
Hỏi thêm nếu thiếu
Đưa ra assumption rõ ràng nếu chưa có dữ liệu
```

### Output

```text
Context Model
User Persona
Current Workflow
Pain Points
Known Constraints
Assumptions
Open Questions
```

### Khi nào lặp lại Phase 1?

Nếu trong quá trình build context phát hiện:

- Problem ban đầu sai.
- Stakeholder chưa đúng.
- Goal chưa phù hợp.

Thì quay lại Phase 1.

---

## Phase 3 — Explore / Divergent Thinking

### Mục tiêu

Sinh nhiều ý tưởng, càng đa dạng càng tốt.

Nguyên lý:

```text
Quantity before Quality
No judgment during generation
Defer criticism
Encourage wild ideas
```

### Thinking State

```text
Divergent Thinking
Creative Thinking
Associative Thinking
```

### Technique có thể dùng

#### SCAMPER

Dùng để biến đổi ý tưởng hiện có.

```text
Substitute — Thay thế gì được?
Combine — Kết hợp với gì được?
Adapt — Mượn từ ngành khác được không?
Modify — Phóng to/thu nhỏ/thay đổi gì?
Put to another use — Dùng cho mục đích khác được không?
Eliminate — Bỏ gì đi được?
Reverse — Đảo ngược gì được?
```

#### Random Word

Dùng khi ý tưởng bị lặp.

Ví dụ:

```text
Topic: Attendance
Random word: Coffee
→ Coffee reward
→ Break-time check-in
→ Daily streak like loyalty stamp
```

#### Forced Connection

Ép kết nối hai thứ không liên quan.

```text
TikTok + Attendance
→ Attendance streak
→ Short video check-in
→ Gamified leaderboard
```

#### Brainwriting

Mỗi người viết idea riêng trước khi thảo luận, giúp giảm việc một người nói quá nhiều.

#### Morphological Analysis

Tạo ma trận các lựa chọn.

Ví dụ với attendance:

```text
Identity: QR / Face / NFC / WiFi
Location: GPS / Office WiFi / Bluetooth
Validation: Manager approval / Auto / Peer confirm
Reward: None / Point / Badge / Bonus
```

Sau đó kết hợp thành nhiều giải pháp.

#### Worst Possible Idea

Nghĩ cách làm tệ nhất, sau đó đảo ngược.

```text
Làm sao để user ghét app attendance?
→ Bắt login nhiều lần
→ App chậm
→ Không nhắc check-in

Đảo ngược:
→ Auto login
→ Fast check-in
→ Smart reminder
```

### Output

```text
Raw Ideas
Idea Count
Idea Tags
Idea Source Technique
Initial Idea Clusters
```

### Khi nào lặp lại Phase 3?

Lặp lại Phase 3 nếu:

- Idea quá ít.
- Idea bị lặp.
- Idea chỉ xoay quanh một nhóm.
- Idea thiếu sự mới lạ.
- Một nhóm chủ đề còn quá mỏng.

AI sẽ đổi technique thay vì tiếp tục hỏi chung chung.

---

## Phase 4 — Expand / Perspective Expansion

### Mục tiêu

Làm giàu ý tưởng bằng nhiều góc nhìn.

Ở phase này, AI không chỉ sinh thêm ý tưởng mà buộc nhóm nhìn idea từ nhiều perspective:

- User.
- Business.
- Technical.
- Risk.
- Emotion.
- Operation.
- Customer journey.
- Stakeholder conflict.

### Thinking State

```text
Perspective Thinking
Empathy Thinking
Systems Thinking
```

### Technique có thể dùng

#### Six Thinking Hats

Dùng để nhìn cùng một ý tưởng bằng 6 chế độ tư duy:

| Hat | Vai trò |
|---|---|
| White Hat | Dữ kiện, thông tin, bằng chứng |
| Red Hat | Cảm xúc, trực giác, phản ứng người dùng |
| Yellow Hat | Lợi ích, cơ hội, điểm tích cực |
| Black Hat | Rủi ro, nhược điểm, vấn đề |
| Green Hat | Ý tưởng mới, phương án thay thế |
| Blue Hat | Tổng hợp, điều phối, quyết định bước tiếp |

Ví dụ với idea “QR + WiFi Check-in”:

```text
White: Cần WiFi công ty và QR session.
Red: Nhân viên thấy nhanh, nhưng có thể khó chịu nếu app bắt nhiều thao tác.
Yellow: Rẻ, dễ triển khai, không cần máy chấm công.
Black: Có thể gửi ảnh QR cho người khác.
Green: Thêm WiFi validation hoặc time window.
Blue: Giữ cho MVP, cần xử lý fake QR.
```

#### Role Storming

Nhóm đóng vai các nhân vật khác nhau:

```text
Nếu tôi là nhân viên thì sao?
Nếu tôi là HR thì sao?
Nếu tôi là CEO thì sao?
Nếu tôi là nhân viên mới thì sao?
Nếu tôi là người hay đi trễ thì sao?
```

#### Stakeholder Lens

Nhìn idea theo từng stakeholder:

```text
Employee
HR
Manager
Admin
Owner
Legal
Finance
```

#### Customer Journey

Đặt idea vào hành trình thật của user:

```text
Before check-in
During check-in
After check-in
Exception case
Report / Review
```

### Output

```text
Enriched Ideas
Perspective Notes
User Concerns
Business Opportunities
Risk Notes
Alternative Ideas
```

### Khi nào quay lại Phase 3?

Nếu trong Green Hat, Role Storming hoặc Journey xuất hiện idea mới đáng chú ý, AI đưa idea đó quay lại Phase 3 để mở rộng tiếp.

---

## Phase 5 — Challenge / Critical Reflection

### Mục tiêu

Kiểm chứng và làm mạnh ý tưởng.

Không phải để “dìm” idea, mà để tìm điểm yếu sớm và cải thiện.

### Thinking State

```text
Critical Thinking
Causal Thinking
Reflective Thinking
First-principles Thinking
```

### Technique có thể dùng

#### Reverse Thinking

Thay vì hỏi:

```text
Làm sao để app thành công?
```

Hỏi:

```text
Làm sao để app thất bại hoàn toàn?
```

Sau đó đảo ngược thành giải pháp.

#### Devil's Advocate

AI hoặc một người đóng vai phản biện:

```text
Vì sao idea này có thể sai?
Nếu tôi là khách hàng khó tính, tôi sẽ chê gì?
Nếu tôi là investor, tôi sẽ hỏi gì?
Nếu tôi là đối thủ, tôi sẽ đánh vào điểm nào?
```

#### Five Whys

Đào nguyên nhân gốc:

```text
Vì sao nhân viên quên check-in?
→ Vì họ không mở app.
Vì sao không mở app?
→ Vì app không có giá trị ngoài check-in.
Vì sao app không có giá trị?
→ Vì chỉ phục vụ HR, không phục vụ nhân viên.
```

#### Assumption Surfacing

Lôi các giả định ẩn ra ánh sáng.

Ví dụ:

```text
Assumption: Nhân viên sẵn sàng mở app mỗi sáng.
Assumption: Công ty nào cũng có WiFi ổn định.
Assumption: HR muốn tự động hoàn toàn.
```

#### First Principles

Bóc về bản chất:

```text
Attendance thực chất cần chứng minh điều gì?
→ Ai?
→ Ở đâu?
→ Khi nào?
→ Có hợp lệ không?
```

Từ đó có thể tạo giải pháp mới không bị lệ thuộc vào GPS/QR.

#### Pre-mortem

Giả sử 6 tháng sau sản phẩm thất bại. Hỏi:

```text
Vì sao thất bại?
Điều gì đã bị bỏ qua?
Dấu hiệu cảnh báo sớm là gì?
```

### Output

```text
Risk List
Root Causes
Assumptions
Counterarguments
Improved Ideas
Kill Criteria
Validation Questions
```

### Khi nào quay lại Phase 2 hoặc Phase 3?

Quay lại Phase 2 nếu phát hiện thiếu dữ liệu quan trọng.

Quay lại Phase 3 nếu phản biện sinh ra hướng giải pháp mới.

---

## Phase 6 — Insight / Idea Synthesis

### Mục tiêu

Không chỉ gom idea, mà rút ra insight.

Brainstorm không nên kết thúc ở “nhiều idea”. Nó phải kết thúc ở:

```text
Cluster → Theme → Pattern → Insight
```

### AI cần làm

```text
Gom idea trùng nhau
Tạo cluster
Gắn theme
Tìm pattern
Tìm tension / contradiction
Tìm opportunity
Tìm insight chính
```

### Ví dụ

Sau 200 ideas, AI phát hiện:

```text
Cluster 1: Attendance Automation — 70 ideas
Cluster 2: Employee Motivation — 40 ideas
Cluster 3: HR Reporting — 35 ideas
Cluster 4: Anti-fraud — 25 ideas
Cluster 5: Onboarding — 20 ideas
```

Insight:

```text
Vấn đề không chỉ là chấm công nhanh, mà là làm sao để attendance trở thành một phần tự nhiên của workflow hằng ngày, không phải một hành động riêng biệt gây khó chịu.
```

### Output

```text
Idea Clusters
Themes
Patterns
Key Insights
Opportunity Areas
Contradictions
Open Questions
```

### Khi nào quay lại Phase 3?

Nếu một cluster quan trọng còn ít idea, AI quay lại Explore riêng cluster đó.

Ví dụ:

```text
Anti-fraud rất quan trọng nhưng chỉ có 3 idea.
→ Quay lại Phase 3, brainstorm riêng anti-fraud.
```

---

## Phase 7 — Decision Making / Prioritization

### Mục tiêu

Chọn ý tưởng đáng làm trước.

Đây là phase hội tụ. Không sinh thêm idea trừ khi phát hiện thiếu nghiêm trọng.

### Thinking State

```text
Convergent Thinking
Trade-off Reasoning
Decision Thinking
```

### Framework có thể dùng

#### ICE

Dùng để sàng lọc nhanh.

```text
Impact — Giá trị nếu làm
Confidence — Mức độ chắc chắn
Ease — Độ dễ làm
```

Phù hợp khi vừa có nhiều ý tưởng sau brainstorm.

#### RICE

Dùng cho roadmap có dữ liệu hơn.

```text
Reach × Impact × Confidence / Effort
```

Phù hợp cho product roadmap.

#### MoSCoW

Dùng để chia scope:

```text
Must Have
Should Have
Could Have
Won't Have
```

Phù hợp để ra MVP scope.

#### Impact Matrix

Dùng để nhìn trực quan:

```text
High Impact + Low Effort = Quick Win
High Impact + High Effort = Big Bet
Low Impact + Low Effort = Fill-in
Low Impact + High Effort = Avoid
```

#### Kano

Dùng để hiểu tác động tới sự hài lòng khách hàng:

```text
Basic
Performance
Excitement
Indifferent
Reverse
```

### Output

```text
Prioritized Ideas
MVP Candidate List
Roadmap Candidate List
Rejected / Deferred Ideas
Decision Rationale
```

### Khi nào quay lại Phase 2?

Nếu thiếu dữ liệu để chấm điểm.

Ví dụ:

```text
Không biết user có thực sự muốn FaceID hay không.
→ Cần user research.
```

---

## Phase 8 — Action Planning

### Mục tiêu

Chuyển insight và idea thành artifact có thể dùng cho dự án phần mềm.

### Output có thể sinh

```text
Product Brief
BRD
PRD
User Story
Event Storming
Domain Model
Architecture
Tech Spec
Prototype Plan
Build Plan
```

### AI cần làm

```text
Tóm tắt quyết định
Ghi rationale
Ghi scope MVP
Ghi open questions
Ghi assumptions cần validate
Ghi risks
Ghi next steps
```

### Ví dụ output cho product

```text
Selected MVP Feature:
QR + WiFi Check-in

Why selected:
High impact, low effort, easy for SME, no hardware cost.

Risks:
Fake QR, weak WiFi, employee privacy concern.

Validation needed:
Test with 5 SME owners and 10 employees.

Next artifact:
Write Product Brief → PRD → Event Storming → Architecture.
```

---

## 7. Vòng lặp chính của hệ thống

Toàn bộ hệ thống hoạt động theo loop:

```text
Observe
↓
Analyze
↓
Diagnose
↓
Select Thinking State
↓
Choose Technique
↓
Facilitate
↓
Capture Trace
↓
Observe Again
```

### 7.1. Observe

AI quan sát:

```text
Transcript
Sticky notes
Idea count
Speaking time
Voting behavior
Reaction / emoji
Topic changes
Decision signals
```

### 7.2. Analyze

AI tính các chỉ số:

```text
Idea Quantity
Idea Diversity
Idea Novelty
Participation Balance
Topic Focus
Conflict Level
Engagement Level
Decision Readiness
```

### 7.3. Diagnose

AI phát hiện pattern:

```text
Idea Saturation — quá ít idea mới
Low Diversity — idea quá giống nhau
Topic Drift — lệch chủ đề
Dominating Speaker — một người nói quá nhiều
Low Participation — nhiều người im lặng
Groupthink Risk — đồng ý quá nhanh
Emotional Conflict — căng thẳng/cãi nhau
Decision Not Ready — chưa đủ insight để chọn
```

### 7.4. Select Thinking State

AI chọn trạng thái tư duy:

```text
Need more ideas → Divergent Thinking
Need more viewpoints → Perspective Thinking
Need stronger critique → Critical Thinking
Need root cause → Causal Thinking
Need synthesis → Reflective Thinking
Need decision → Convergent Thinking
```

### 7.5. Choose Technique

AI chọn kỹ thuật:

```text
Divergent → SCAMPER / Random Word / Brainwriting
Perspective → Six Hats / Role Storming / Stakeholder Lens
Critical → Devil's Advocate / Reverse Thinking / Pre-mortem
Causal → Five Whys / Fishbone / First Principles
Convergent → ICE / RICE / MoSCoW / Impact Matrix / Kano
```

### 7.6. Facilitate

AI đưa instruction cho phòng brainstorm.

Ví dụ:

```text
“Mình thấy các idea đang bị lặp quanh GPS. Bây giờ chuyển sang Random Word trong 5 phút. Từ khóa là Coffee. Mỗi người viết 3 idea liên quan đến Coffee + Attendance.”
```

### 7.7. Capture Trace

AI lưu:

```text
Idea sinh ra lúc nào
Từ technique nào
Ai bổ sung
Rủi ro nào được phát hiện
Điểm ưu tiên
Trạng thái hiện tại
```

---

## 8. Bảng mapping Diagnosis → Thinking State → Technique

| Diagnosis | Thinking State cần kích hoạt | Technique phù hợp |
|---|---|---|
| Idea quá ít | Divergent Thinking | Brainwriting, SCAMPER |
| Idea bị lặp | Divergent / Associative Thinking | Random Word, Forced Connection |
| Toàn ý tưởng kỹ thuật | Perspective Thinking | Customer Journey, Stakeholder Lens |
| Thiếu góc nhìn business | Perspective Thinking | Business Lens, Six Hats Yellow |
| Quá lạc quan | Critical Thinking | Black Hat, Devil's Advocate, Pre-mortem |
| Quá tiêu cực | Opportunity Thinking | Yellow Hat, Reframing |
| Cãi nhau cảm tính | Evidence Thinking | White Hat |
| Đồng ý quá nhanh | Critical Thinking | Devil's Advocate |
| Không rõ nguyên nhân | Causal Thinking | Five Whys, Fishbone |
| Nhiều idea nhưng rời rạc | Reflective Thinking | Clustering, Affinity Mapping |
| Đủ idea nhưng chưa chọn được | Convergent Thinking | ICE, RICE, Impact Matrix |
| Cần scope MVP | Prioritization Thinking | MoSCoW |
| Cần hiểu customer delight | Customer Value Thinking | Kano |

---

## 9. Thinking Trace Model

Mỗi idea nên được lưu theo schema:

```yaml
idea_id: IDEA-001
title: QR + WiFi Check-in
status: selected_for_mvp
created_at: 09:15
created_by: participant_03
source_phase: Explore
source_technique: SCAMPER

history:
  - time: 09:15
    event: created
    detail: Generated during SCAMPER Combine round
  - time: 09:22
    event: expanded
    technique: Six Thinking Hats - Green Hat
    detail: Added WiFi validation to reduce QR sharing
  - time: 09:28
    event: challenged
    technique: Devil's Advocate
    detail: Risk found: users can share QR screenshot
  - time: 09:35
    event: improved
    technique: First Principles
    detail: Added time window + office WiFi requirement
  - time: 09:45
    event: scored
    framework: ICE
    score:
      impact: 9
      confidence: 8
      ease: 9
  - time: 09:50
    event: decision
    detail: Selected for MVP

risks:
  - Fake QR
  - Weak office WiFi
  - Privacy concern

assumptions:
  - Employees have smartphones
  - Office has stable WiFi
  - SME wants low-cost setup

next_steps:
  - Validate with 5 SME owners
  - Prototype QR + WiFi flow
  - Define anti-fraud business rules
```

---

## 10. Tool feature ideas

### 10.1. Room Setup

- Create brainstorm room.
- Define topic.
- Define goal.
- Add participants.
- Select duration.
- Select mode: exploration, product discovery, MVP planning, problem solving.

### 10.2. Live Facilitation

- AI gives instructions.
- Timer for each round.
- Silent writing mode.
- Round-robin sharing.
- Anonymous idea submission.
- Auto-detect low participation.
- Auto-switch technique suggestion.

### 10.3. Idea Board

- Sticky notes.
- Idea tagging.
- Idea grouping.
- Duplicate detection.
- Idea evolution view.
- Link idea to technique.

### 10.4. Thinking State Dashboard

Show live metrics:

```text
Idea count
Idea diversity
Participation balance
Topic focus
Novelty score
Conflict level
Decision readiness
```

### 10.5. Technique Library

Technique categories:

```text
Divergent Techniques
Perspective Techniques
Critical Techniques
Causal Techniques
Convergent Techniques
Reflective Techniques
```

### 10.6. Decision Board

- ICE scoring.
- RICE scoring.
- MoSCoW board.
- Impact Matrix.
- Kano classification.
- Voting.
- Decision rationale.

### 10.7. Export

- Brainstorming report.
- Product Brief.
- BRD.
- PRD.
- Event Storming input.
- Architecture input.
- Tech Spec input.

---

## 11. Hermes Agent integration

Hermes Agent có thể dùng như **agent runtime** cho tool này.

Hermes phù hợp vì có:

- Agent loop.
- Tool registry.
- Memory/context.
- Skill system.
- Execution layer.

Nhưng Hermes không phải phần khác biệt chính. Hermes chỉ là nền chạy agent.

Phần khác biệt nên là:

```text
Thinking Orchestrator
├── Session Observer
├── Metrics Engine
├── Diagnosis Engine
├── Thinking State Engine
├── Technique Router
├── Facilitation Engine
└── Thinking Trace Engine
```

### Mapping với Hermes

```text
Hermes AIAgent
→ chạy vòng Think / Act / Observe

Thinking Orchestrator
→ custom logic để phân tích brainstorm session

Skill System
→ chứa SCAMPER, Six Hats, Five Whys, Reverse Thinking...

Tool Registry
→ timer, voting, board, clustering, export

Memory
→ lưu session history, idea history, technique effectiveness
```

### Không nên làm multi-agent quá sớm

MVP nên bắt đầu với:

```text
1 Main Facilitator Agent
+ Technique Skills
+ Trace Storage
+ Simple Dashboard
```

Sau đó mới tách:

```text
Critic Agent
Research Agent
Synthesis Agent
Product Agent
Architecture Agent
```

---

## 12. MVP đề xuất

### MVP 1 — AI Facilitated Brainstorm Room

Tính năng tối thiểu:

- Tạo room brainstorm.
- Nhập topic, goal, constraint.
- AI hỏi Problem Framing.
- AI chọn technique thủ công hoặc gợi ý.
- Idea board đơn giản.
- Ghi trace cơ bản.
- Cluster idea.
- ICE scoring.
- Export report markdown.

### MVP 2 — Adaptive Facilitation

Bổ sung:

- Detect idea duplication.
- Detect low diversity.
- Detect low participation.
- Suggest technique switch.
- Six Thinking Hats guided mode.
- Reverse Thinking guided mode.
- Five Whys guided mode.

### MVP 3 — Thinking Orchestrator

Bổ sung:

- Full Observe → Analyze → Diagnose loop.
- Thinking state dashboard.
- Technique recommendation engine.
- Decision readiness score.
- Thinking trace timeline.

### MVP 4 — Product Pipeline

Bổ sung:

- Export Product Brief.
- Export BRD.
- Export PRD.
- Export Event Storming seed.
- Export Architecture input.
- Integration with AI coding workflow.

---

## 13. Ví dụ flow thực tế: Wookki Attendance

### Setup

```text
Topic: Attendance for SME HRM app
Goal: Find MVP attendance solution
Stakeholder: SME owner, HR, employee
Constraint: Low cost, no hardware, easy setup
```

### Problem Framing

AI hỏi:

```text
SME đang chấm công bằng gì?
Điểm đau lớn nhất là gì?
Ai cần dữ liệu attendance?
Thành công MVP là gì?
```

Output:

```text
Problem: SME dùng Excel/Zalo để chấm công, dữ liệu thiếu chính xác, HR tốn thời gian tổng hợp.
Goal: Tạo giải pháp chấm công rẻ, dễ triển khai, giảm thao tác thủ công.
```

### Explore

AI dùng SCAMPER:

```text
Substitute máy chấm công bằng gì?
→ QR, WiFi, GPS, NFC, Zalo bot

Combine QR với gì?
→ QR + WiFi
→ QR + GPS
→ QR + time window
```

### Expand

AI dùng Six Thinking Hats với QR + WiFi:

```text
White: Cần WiFi công ty, QR session, timestamp.
Red: Nhân viên muốn nhanh, không muốn bị theo dõi quá mức.
Yellow: Rẻ, dễ triển khai, không cần máy.
Black: Có thể share QR, WiFi yếu.
Green: Thêm time window, device binding, manager approval.
Blue: Giữ làm MVP candidate.
```

### Challenge

AI dùng Devil's Advocate:

```text
Nếu tôi là người muốn gian lận, tôi sẽ làm gì?
→ Chụp QR gửi bạn.
→ Nhờ bạn check-in hộ.
```

Cải thiện:

```text
QR đổi liên tục
Yêu cầu cùng WiFi
Giới hạn thời gian
Log device
```

### Insight

AI cluster:

```text
Automation
Anti-fraud
Employee Experience
HR Reporting
```

Insight:

```text
MVP không nên tối ưu công nghệ nhận diện phức tạp, mà nên tối ưu triển khai nhanh + chống gian lận vừa đủ cho SME.
```

### Decision

ICE:

```text
QR + WiFi: Impact 9, Confidence 8, Ease 9 → 26
GPS: Impact 8, Confidence 7, Ease 7 → 22
FaceID: Impact 9, Confidence 5, Ease 3 → 17
```

Decision:

```text
Chọn QR + WiFi cho MVP.
FaceID để phase sau.
```

### Action

Export:

```text
Product Brief
PRD Attendance Module
Event Storming seed:
- Employee checked in
- Check-in validated
- Attendance record created
- Late check-in flagged
- HR reviewed attendance
```

---

## 14. Điểm khác biệt của sản phẩm

Nếu chỉ nói “tool có nhiều kỹ thuật brainstorming” thì chưa mới.

Điểm khác biệt nên là:

```text
AI quan sát trạng thái brainstorm
→ phân tích chất lượng tư duy
→ tự chọn thinking state
→ đề xuất technique phù hợp
→ điều phối nhóm
→ lưu thinking trace
→ chuyển insight thành artifact dự án
```

Đây không còn là chatbot brainstorm, mà là **AI Facilitator / Thinking Orchestration Engine**.

---

## 15. Kết luận

Tool này phù hợp để phát triển theo hướng:

```text
Brainstorm Room
→ AI Facilitator
→ Thinking Orchestrator
→ Product Discovery Pipeline
```

Giá trị chính không nằm ở việc AI sinh nhiều idea, mà nằm ở việc AI giúp nhóm:

- Nghĩ đúng vấn đề.
- Nghĩ đa chiều.
- Không bị kẹt trong một góc nhìn.
- Phản biện đúng lúc.
- Hội tụ đúng lúc.
- Biết vì sao chọn một ý tưởng.
- Chuyển idea thành Product Brief, PRD, Event Storming, Architecture và Build Plan.

Một câu mô tả ngắn gọn:

> AI Brainstorm Room là một AI Facilitator giúp nhóm điều phối các chế độ tư duy, chọn kỹ thuật phù hợp theo trạng thái phiên brainstorm, ghi lại thinking trace, và chuyển insight thành artifact phục vụ phát triển sản phẩm.
