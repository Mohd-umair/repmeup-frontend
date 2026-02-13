Social Media Account Management System Design
Complete UX, UI, and Technical Architecture
1. Core UX Problems Identified
Current Issues:
No Clear Account Selection: OAuth flow auto-connects ALL available accounts without user choice
Hidden User-Level Token: Technical concept (user token vs page token) exposed to users
Duplicate Connections: Same account appears multiple times
No Plan Visibility: Users don't know their account limits
Unclear Status: "Connected" vs "Available" vs "In Use" is ambiguous
No Hierarchy: Facebook Pages with linked Instagram accounts create confusion
Page Manager Hidden: Critical feature is buried, not part of main flow
User Mental Model Failures:
Users think "Connect Instagram" = "Use Instagram in my dashboard"
Users don't understand they need to select WHICH page/account to use
Users don't know how many accounts they can connect per plan
Users can't predict what happens when they authenticate
2. Information Architecture
Settings└── Social Accounts (main section)    ├── Overview Card    │   ├── Plan Info: "Pro Plan - 5 of 10 accounts connected"    │   ├── Quick Actions: "Connect Account" button    │   └── Upgrade CTA (if at limit)    │    ├── Connected Accounts List    │   ├── Account Card (Instagram)    │   ├── Account Card (Facebook Page)    │   └── Account Card (LinkedIn)    │    └── Available Accounts (expandable)        ├── "You have 3 more accounts available to connect"        └── List of authenticated-but-not-connected accounts
Navigation Structure:
Settings (sidebar)├── Profile├── Team├── Social Accounts ⭐ (main entry point)├── Subscription & Billing└── Notifications
Remove: Separate "Platforms" section (confusing duplication)
3. Ideal Connection Flow
Step 1: Entry Point (Settings > Social Accounts)
Empty State (0 accounts connected):
┌─────────────────────────────────────────────────────┐│  🌟 Connect Your First Social Account                ││                                                       ││  Link your Instagram, Facebook, or LinkedIn          ││  accounts to start managing your presence            ││                                                       ││  Your Plan: Starter (Up to 3 accounts)               ││                                                       ││  [Connect Instagram] [Connect Facebook] [Connect +]  │└─────────────────────────────────────────────────────┘
Step 2: Platform Selection
User clicks "Connect Instagram"
Loading State:
Redirecting to Instagram...You'll be asked to authorize RepMeUp
Step 3: OAuth Authorization (External)
User logs into Instagram/Facebook
Grants permissions
Returns to app
Step 4: Account Selection (Critical New Step) ⭐
Modal/Screen: "Select Accounts to Connect"
┌─────────────────────────────────────────────────────┐│  Select Instagram Accounts to Connect                ││  ─────────────────────────────────────────────────   ││                                                       ││  You've authorized access to these accounts.         ││  Select which ones you want to use in RepMeUp:       ││                                                       ││  Your Plan: 1 of 3 accounts connected                ││  You can select up to 2 more accounts                ││                                                       ││  ☐ [ ] @rep_me_up                                   ││      Instagram Business • Repmeup Page               ││      2.5K followers                                   ││                                                       ││  ☐ [ ] @orm_official                                ││      Instagram Business • ORM Page                    ││      1.2K followers                                   ││                                                       ││  ⚠️ You can only select 2 accounts (plan limit)      ││                                                       ││  [Cancel]                    [Connect Selected (0)]  │└─────────────────────────────────────────────────────┘
Interactions:
Checkboxes are limited by plan (max 2 more in example)
"Connect Selected" button shows count and is disabled until ≥1 selected
Real-time validation: disable checkboxes when limit reached
Show preview: follower count, page name, profile picture
Step 5: Confirmation & Success
Success Message:
✅ 2 Instagram accounts connected successfully!• @rep_me_up is now connected• @orm_official is now connectedYou can now publish posts and manage these accounts.[Go to Dashboard] [Connect More Accounts]
Step 6: Post-Connection State
Settings > Social Accounts:
┌─────────────────────────────────────────────────────┐│  📊 Your Social Accounts                             ││  ─────────────────────────────────────────────────   ││  Plan: Pro Plan • 3 of 10 accounts connected         ││  [+ Connect Account] [Upgrade Plan]                  │└─────────────────────────────────────────────────────┘Connected Accounts (3)─────────────────────────────────────────────────────┌─────────────────────────────────────────────────────┐│ 📷 @rep_me_up                           [Disconnect] ││    Instagram Business                                 ││    Connected via Repmeup Facebook Page               ││    Last synced: 2 min ago • 28 comments               │└─────────────────────────────────────────────────────┘┌─────────────────────────────────────────────────────┐│ 📘 Repmeup                              [Disconnect] ││    Facebook Page                                      ││    Last synced: 2 min ago • 3 posts                   │└─────────────────────────────────────────────────────┘Available to Connect (2)─────────────────────────────────────────────────────▼ You have access to 2 more accounts┌─────────────────────────────────────────────────────┐│ 📷 @orm_official                           [Connect] ││    Instagram Business • ORM Page                      ││    Not connected • Will use 1 account slot            │└─────────────────────────────────────────────────────┘┌─────────────────────────────────────────────────────┐│ 📘 ORM                                     [Connect] ││    Facebook Page                                      ││    Not connected • Will use 1 account slot            │└─────────────────────────────────────────────────────┘
4. UI Components & States
A. Plan Status Banner
Location: Top of Social Accounts page
Variants:
✅ Healthy: "3 of 10 accounts connected" (Green)⚠️  Near Limit: "9 of 10 accounts connected" (Yellow)🔒 At Limit: "10 of 10 accounts connected - Upgrade to connect more" (Orange)
B. Account Card Component
Structure:
┌─────────────────────────────────────────────────────┐│ [Platform Icon] @username              [Action Btn] ││ Account Type • Parent Connection                     ││ Status Badge • Metadata                              ││ Last Activity • Quick Stats                          │└─────────────────────────────────────────────────────┘
States:
Connected (in use):
Green checkmark badge
"Disconnect" button (destructive)
Shows last sync, stats
Available (authenticated but not connected):
Gray/disabled appearance
"Connect" button (primary)
Shows "Will use 1 slot"
Disabled if at plan limit
Disconnected (previously used):
Red X badge
"Reconnect" button
Shows "Previously connected"
Syncing:
Spinner/pulse animation
"Syncing..." text
Disabled disconnect button
C. Modal: Account Selection (Step 4 of flow)
Features:
Multi-select checkboxes
Real-time counter: "2 of 5 selected"
Plan limit indicator
Visual feedback on hover
Disabled state for accounts exceeding limit
Search/filter (if >10 accounts)
D. Empty State
First Time:
🌟 illustrationConnect Your Social AccountsManage all your social media from one place[Connect Instagram] [Connect Facebook] [View All Platforms]
All Disconnected (had accounts before):
😔 No Accounts ConnectedYou previously had 3 accounts connected[Reconnect Accounts] [Connect New Account]
E. Limit Reached State
Banner:
🔒 Account Limit ReachedYou've connected all 10 accounts included in your Pro Plan.Upgrade to Business to connect up to 50 accounts.[Upgrade Now] [Manage Accounts]
Connect Button (disabled):
[+ Connect Account] ← Disabled, tooltip: "Upgrade your plan to connect more accounts"
5. Backend Data Models
A. Updated PlatformConnection Schema
{  _id: ObjectId,  organization: ObjectId (ref: Organization),  createdBy: ObjectId (ref: User),    // Account Identity  platform: String (enum: ['instagram', 'facebook', ...]),  platformUserId: String, // Platform's unique ID  platformUsername: String,  platformDisplayName: String,  platformPageId: String (nullable), // For Facebook Pages    // Connection Status  status: String (enum: [    'available',    // ⭐ NEW: Authenticated but not actively connected    'connected',    // Actively in use    'disconnected', // Previously connected, now inactive    'error'         // Has auth issues  ]),  isActive: Boolean, // Quick filter    // Tokens  accessToken: String (encrypted),  refreshToken: String (encrypted),  tokenExpiresAt: Date,    // Metadata  metadata: {    type: String (enum: ['user_token', 'account_token']),    purpose: String, // 'page_management' or 'publishing'    parentConnection: ObjectId, // Link Instagram to Facebook Page    accountType: String, // 'business', 'personal', 'creator'    profilePicture: String,    followerCount: Number,    isVerified: Boolean  },    // Usage Tracking  connectedAt: Date, // When user clicked "Connect"  disconnectedAt: Date,  lastSyncAt: Date,  syncCount: Number,    // Plan Enforcement  usesAccountSlot: Boolean, // Does this count toward plan limit?  slotPriority: Number, // For sorting when showing "which to disconnect"    timestamps: true}
Key Changes:
status has 4 states instead of 2
usesAccountSlot determines if it counts toward plan
User-level tokens have usesAccountSlot: false
Account tokens have usesAccountSlot: true
B. Subscription Schema Enhancement
{  _id: ObjectId,  organization: ObjectId,  plan: {    name: String, // 'Starter', 'Pro', 'Business'    tier: Number, // 1, 2, 3    limits: {      maxAccounts: Number, // 3, 10, 50      maxUsers: Number,      maxPostsPerMonth: Number    }  },  usage: {    connectedAccounts: Number, // Real-time count    activeUsers: Number,    postsThisMonth: Number  },  status: String (enum: ['active', 'cancelled', 'past_due']),  currentPeriodEnd: Date}
C. New: AccountAuthSession Collection
Temporary storage for OAuth flow:
{  _id: ObjectId,  user: ObjectId,  organization: ObjectId,  platform: String,  state: String, // OAuth state token  availableAccounts: [{    platformUserId: String,    username: String,    displayName: String,    accountType: String,    followerCount: Number,    profilePicture: String,    pageAccessToken: String, // Temporary    parentPageId: String // For Instagram linked to FB Page  }],  expiresAt: Date, // 10 minutes  createdAt: Date}
Purpose: Store available accounts between OAuth callback and user selection
6. API Endpoints
A. Account Management
POST   /api/social-accounts/auth/:platform  → Initiates OAuth (returns auth URL)GET    /api/social-accounts/auth/:platform/callback  → OAuth callback  → Creates AccountAuthSession with available accounts  → Redirects to account selectionGET    /api/social-accounts/available  → Returns authenticated-but-not-connected accounts  → Response:    {      accounts: [...],      plan: {        name: 'Pro',        maxAccounts: 10,        connected: 3,        remaining: 7      }    }POST   /api/social-accounts/connect  → Body: { accountIds: ['id1', 'id2'] }  → Validates against plan limit  → Changes status from 'available' → 'connected'  → Response: { connected: [...], failed: [...], limitReached: bool }DELETE /api/social-accounts/:id/disconnect  → Changes status to 'disconnected'  → Frees up account slot  → Response: { success: true, slotsAvailable: 8 }GET    /api/social-accounts  → Returns all accounts grouped by status:    {      connected: [...],      available: [...],      disconnected: [...],      plan: {...}    }POST   /api/social-accounts/:id/reconnect  → Changes status from 'disconnected' → 'connected'  → Validates plan limit
B. Plan & Limit Checking
GET    /api/subscription/limits  → Returns:    {      plan: 'Pro',      maxAccounts: 10,      connectedAccounts: 3,      canConnectMore: true,      nextTier: {        name: 'Business',        maxAccounts: 50,        price: 99      }    }POST   /api/subscription/check-limit  → Body: { accountsToConnect: 2 }  → Returns:    {      allowed: false,      current: 9,      max: 10,      requested: 2,      exceededBy: 1,      upgradeRequired: true    }
7. Guardrails & Validations
Frontend Validations
// Before showing account selection modalasync validateSelection(selectedAccounts: string[]) {  const plan = await this.getPlanLimits();  const connected = plan.connectedAccounts;  const max = plan.maxAccounts;  const selecting = selectedAccounts.length;    if (connected + selecting > max) {    const exceededBy = (connected + selecting) - max;        this.showError({      title: 'Account Limit Reached',      message: `You can only connect ${max - connected} more account(s).                 You selected ${selecting}.                 Please unselect ${exceededBy} account(s) or upgrade your plan.`,      actions: [        { label: 'Upgrade Plan', action: () => this.navigateToUpgrade() },        { label: 'Adjust Selection', primary: true }      ]    });        return false;  }    return true;}
UI Enforcement:
Disable checkboxes after limit reached
Show tooltip on disabled checkboxes: "Upgrade to connect more"
Real-time counter updates as user selects
"Connect Selected" button disabled if exceeds limit
Backend Validations
// POST /api/social-accounts/connectasync connectAccounts(req, res) {  const { accountIds } = req.body;  const org = req.user.organization;    // 1. Get plan limits  const subscription = await Subscription.findOne({ organization: org._id });  const maxAccounts = subscription.plan.limits.maxAccounts;    // 2. Count currently connected  const connectedCount = await PlatformConnection.countDocuments({    organization: org._id,    status: 'connected',    usesAccountSlot: true  });    // 3. Validate limit  if (connectedCount + accountIds.length > maxAccounts) {    return res.status(403).json({      success: false,      error: 'ACCOUNT_LIMIT_EXCEEDED',      message: `Your ${subscription.plan.name} plan allows ${maxAccounts} accounts.                 You have ${connectedCount} connected.                 Cannot connect ${accountIds.length} more.`,      currentCount: connectedCount,      maxAllowed: maxAccounts,      upgradeUrl: '/subscription/upgrade'    });  }    // 4. Connect accounts  const results = await Promise.allSettled(    accountIds.map(id => this.connectSingleAccount(id, org._id))  );    // 5. Update subscription usage  await Subscription.updateOne(    { organization: org._id },    { $set: { 'usage.connectedAccounts': connectedCount + accountIds.length } }  );    return res.json({    success: true,    connected: results.filter(r => r.status === 'fulfilled'),    failed: results.filter(r => r.status === 'rejected'),    plan: {      connected: connectedCount + accountIds.length,      max: maxAccounts,      remaining: maxAccounts - (connectedCount + accountIds.length)    }  });}
Validation Rules:
✅ Check plan limits before any connection
✅ Atomic operations (all or nothing)
✅ Update usage counts immediately
✅ Webhook to billing system if approaching limit
✅ Grace period: Allow 1 over-limit for 24h (warn user)
8. User Guidance & Education
A. First-Time User Onboarding
Step 1: Intro Modal (after signup)
┌─────────────────────────────────────────────────────┐│  Welcome to RepMeUp! 🎉                              ││  ─────────────────────────────────────────────────   ││  Let's connect your first social media account       ││                                                       ││  Your Starter Plan includes:                         ││  ✓ 3 social media accounts                          ││  ✓ Unlimited posts                                   ││  ✓ AI-powered responses                              ││                                                       ││  [Connect Instagram] [Connect Facebook] [Skip]       │└─────────────────────────────────────────────────────┘
B. Contextual Tooltips
Hover over account card: "This account counts as 1 of your 3 allowed accounts"
Hover over "Connect" button (at limit): "Upgrade your plan to connect more accounts"
Hover over plan badge: "You're on the Pro Plan. Click to see details"
C. In-App Notifications
⚠️ You're using 9 of 10 accountsConsider upgrading to Business Plan for 50 accounts[Upgrade] [Dismiss]
Trigger when: connectedAccounts >= (maxAccounts * 0.9)
D. Help Center Integration
"?" icon next to "Social Accounts" → Opens help:
How do I connect my Instagram?
Why can't I connect more accounts?
What's the difference between Available and Connected?
How do I upgrade my plan?
9. Scalability Considerations
A. Multi-Platform Support
Current: Instagram, Facebook
Future: LinkedIn, Twitter/X, TikTok, Pinterest, YouTube
Pattern: Each platform has:
{  id: 'linkedin',  name: 'LinkedIn',  icon: 'fab fa-linkedin',  authType: 'oauth2',  supportsMultipleAccounts: true,  accountTypes: ['personal', 'company'],  oauthScopes: [...],  accountSelectionSupported: true // Some platforms might not}
B. Plan Tiers
const PLANS = {  free: {    name: 'Free',    maxAccounts: 1,    platformsAllowed: ['instagram', 'facebook'],    features: ['basic-posting']  },  starter: {    name: 'Starter',    maxAccounts: 3,    platformsAllowed: ['instagram', 'facebook', 'linkedin'],    features: ['basic-posting', 'scheduling', 'analytics']  },  pro: {    name: 'Pro',    maxAccounts: 10,    platformsAllowed: 'all',    features: ['all', 'ai-responses', 'team-collaboration']  },  business: {    name: 'Business',    maxAccounts: 50,    platformsAllowed: 'all',    features: ['all', 'custom-branding', 'api-access']  },  enterprise: {    name: 'Enterprise',    maxAccounts: -1, // unlimited    platformsAllowed: 'all',    features: ['all', 'dedicated-support', 'sla']  }};
C. Future Features
Account Groups:
└── My Accounts (10/10)    ├── Personal Brand (3)    │   ├── @myname (Instagram)    │   ├── My Page (Facebook)    │   └── LinkedIn Profile    │    └── Client: Acme Corp (7)        ├── @acme_official (Instagram)        ├── Acme Corp (Facebook)        └── ...
Scheduled Disconnection:
"Disconnect on [date]" - useful for agencies losing clients
Automatically frees slot
Account Health:
Auth expiry warnings
Permission issues
API quota usage
10. Implementation Checklist
Phase 1: Core Architecture (Week 1-2)
[ ] Update PlatformConnection schema with new status field
[ ] Create AccountAuthSession model
[ ] Add Subscription schema with limits
[ ] Implement plan validation middleware
[ ] Update OAuth callbacks (don't auto-connect)
Phase 2: Backend APIs (Week 2-3)
[ ] /api/social-accounts/available endpoint
[ ] /api/social-accounts/connect with validation
[ ] /api/social-accounts (grouped by status)
[ ] /api/subscription/limits endpoint
[ ] Plan limit checking logic
Phase 3: Frontend UI (Week 3-4)
[ ] New "Social Accounts" settings page
[ ] Account selection modal component
[ ] Plan status banner component
[ ] Account card component (3 states)
[ ] Empty states
[ ] Limit reached states
Phase 4: Connection Flow (Week 4-5)
[ ] Update OAuth initiation (save session)
[ ] Account selection screen after OAuth
[ ] Bulk connect with validation
[ ] Success/error feedback
[ ] Available accounts list
Phase 5: Polish & Testing (Week 5-6)
[ ] Error handling & edge cases
[ ] Loading states & animations
[ ] Mobile responsive design
[ ] E2E tests for connection flow
[ ] Plan limit enforcement tests
[ ] User acceptance testing
11. Success Metrics
User Understanding (Target: 90%+ comprehension)
Q: "How many accounts can you connect?"
A: Should mention plan limit
Task Completion Rate (Target: 95%+)
Connect first account successfully
Connect additional account within plan
Understand when limit is reached
Support Tickets (Target: -80% reduction)
"Why are there duplicate accounts?" → 0
"How many accounts can I connect?" → Answered in UI
"Which account is connected?" → Clear in UI
Conversion to Upgrade (Target: +25%)
Users hitting plan limit and upgrading
Clear upgrade path from limit state
12. Rationale for Major Decisions
Decision 1: Account Selection Modal
Why: Gives users explicit control, matches mental model of "choosing" which accounts to use
Examples:
Buffer shows all pages after Facebook auth
Hootsuite lets you select social profiles
Later shows Instagram accounts selector
Decision 2: "Available" vs "Connected" Status
Why: Separates technical auth (available) from business intent (connected)
Benefit:
Users can authenticate once, select/deselect accounts freely
No need to re-authenticate when swapping accounts
Clear distinction between "I have access" and "I'm using this"
Decision 3: Plan Status Always Visible
Why: Constant reinforcement of limits prevents surprise, encourages upgrades
Examples:
Slack shows "X of Y members" in sidebar
GitHub shows "X of Y repos" on dashboard
Notion shows "X of Y blocks" in workspace
Decision 4: No Auto-Connect on OAuth
Why: Auto-connecting creates confusion, removes user agency
Old Flow: Click → Auth → Surprise! 3 accounts connected
New Flow: Click → Auth → Choose → Connect selected → Confirmation
Decision 5: User-Level Token Hidden
Why: Technical implementation detail, not user concern
Implementation:
Backend uses user token for /me/accounts calls
User never sees this connection
Doesn't count toward plan limit
Decision 6: Two-Tier Architecture
Why: Scalable for agencies managing multiple client accounts
Future:
Organization (Agency)├── User-level auths (hidden, for accessing accounts)└── Account-level connections (visible, counts toward limit)    ├── Client A accounts    └── Client B accounts
13. Reference: Best-in-Class Examples
Buffer
Strength: Clear account picker after auth
Pattern: Card-based selection with checkboxes
Copy: "Select which social accounts to add"
Hootsuite
Strength: Grouped by platform, shows plan limits
Pattern: "3 of 10 profiles connected"
Warning: Shows upgrade prompt when approaching limit
Later
Strength: Instagram-focused, shows linked Facebook Pages
Pattern: Hierarchical display (Page → Instagram)
UX: Clear "Add Profile" vs "Manage Profiles"
Notion
Strength: Plan limits always visible
Pattern: Progress bar showing usage
Upgrade CTA: Contextual, non-intrusive
Final Recommendation
Implement this design in phases, starting with Phase 1-2 (backend architecture) while current UI continues to work. This allows gradual migration and A/B testing of the new flow.
Priority: Account Selection Modal (Phase 3-4) is the highest UX impact change.
Quick Win: Add plan status banner immediately to current UI while building new flow.
This architecture supports your subscription model, scales to enterprise clients, and follows SaaS best practices that users expect from mature products.
